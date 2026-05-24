import pino from 'pino'
import {
  type ConnectorContext,
  type ConnectorResult,
  getCredentials,
  mergeEnvCredentials,
  isTokenExpired,
  refreshOAuthToken,
  ConnectorAuthError,
  ConnectorRateLimitError,
} from './types.js'

const logger = pino({ name: 'connector:google' })

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

interface GoogleReview {
  reviewId: string
  reviewer: { displayName?: string; profilePhotoUrl?: string }
  starRating: string
  comment?: string
  createTime: string
  updateTime?: string
  name: string
  reviewReply?: { comment: string; updateTime: string }
}

interface GoogleReviewsResponse {
  reviews?: GoogleReview[]
  nextPageToken?: string
  totalReviewCount?: number
  averageRating?: number
}

interface PlacesReview {
  author_name: string
  author_url?: string
  rating: number
  text?: string
  time: number
  relative_time_description?: string
  profile_photo_url?: string
}

interface PlacesDetailsResponse {
  status: string
  result?: { reviews?: PlacesReview[] }
  error_message?: string
}

async function fetchViaPlacesApi(
  ctx: ConnectorContext,
  placeId: string,
  mapsApiKey: string,
  locationId: string,
): Promise<ConnectorResult> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews&key=${mapsApiKey}&language=en`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[Google Places] HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as PlacesDetailsResponse

  if (data.status !== 'OK') {
    throw new ConnectorAuthError('Google', `Places API error: ${data.status} ${data.error_message ?? ''}`)
  }

  const reviews = data.result?.reviews ?? []

  logger.info(
    { sourceId: ctx.sourceId, count: reviews.length, source: 'places_api' },
    'google.reviews_fetched',
  )

  const deliveries = reviews.map((review) => {
    const contributorId = review.author_url?.split('/contrib/')[1]?.split('/')[0] ?? `${review.time}`
    return {
      externalId: `places_${review.time}_${contributorId}`,
      body: review.text ?? '',
      rating: review.rating ?? null,
      externalAuthorLabel: review.author_name ?? null,
      canonicalUrl: `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`,
      postedAt: new Date(review.time * 1000).toISOString(),
      subjectType: 'location',
      subjectKey: locationId,
      subjectLabel: (ctx.scopeConfig.locationLabel as string) ?? locationId,
      providerStatus: 'visible',
      providerMetadata: {
        reviewReply: null,
        relativeTimeDescription: review.relative_time_description,
        placeId,
        source: 'places_api',
      },
      rawPayload: review,
    }
  })

  return { deliveries, nextCursor: null, updatedCredentials: undefined }
}

export async function fetchGoogleBusinessProfileReviews(
  ctx: ConnectorContext,
): Promise<ConnectorResult> {
  const credentials = mergeEnvCredentials(getCredentials(ctx.scopeConfig), 'GOOGLE')
  if (!credentials || !credentials.accessToken) {
    throw new ConnectorAuthError('Google', 'No credentials configured — connect via OAuth or set CEQ_GOOGLE_CLIENT_ID/CEQ_GOOGLE_CLIENT_SECRET env vars')
  }

  const accountId = ctx.scopeConfig.accountId as string | undefined
  const locationId = ctx.scopeConfig.locationId as string | undefined
  if (!accountId || !locationId) {
    throw new Error('[Google] Missing accountId or locationId in scopeConfig')
  }

  let updatedCredentials: Record<string, unknown> | undefined

  if (isTokenExpired(credentials)) {
    const refreshed = await refreshOAuthToken({
      provider: 'Google',
      tokenUrl: GOOGLE_TOKEN_URL,
      credentials,
    })
    credentials.accessToken = refreshed.accessToken
    updatedCredentials = {
      ...credentials,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenExpiresAt: refreshed.expiresAt,
    }
  }

  const cursor = ctx.lastCursor as { pageToken?: string } | null
  const params = new URLSearchParams({ pageSize: '50' })
  if (cursor?.pageToken) {
    params.set('pageToken', cursor.pageToken)
  }

  // Primary: Google Business Profile API v4 (requires Google partner/elevated API access).
  // If the project has not yet been approved, this returns 403 SERVICE_DISABLED and we
  // fall back to the Google Places API (up to 5 reviews) when placeId is configured.
  const v4Url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?${params}`

  const rawResponse = await fetch(v4Url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
    },
  })

  if (rawResponse.status === 401) {
    const text = await rawResponse.text().catch(() => '')
    throw new ConnectorAuthError('Google', `HTTP 401: ${text.slice(0, 200)}`)
  }

  if (rawResponse.status === 429) {
    const retryAfter = rawResponse.headers.get('retry-after')
    const ms = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000
    throw new ConnectorRateLimitError('Google', ms)
  }

  if (rawResponse.status === 403) {
    const errText = await rawResponse.text().catch(() => '')
    const placeId = ctx.scopeConfig.placeId as string | undefined
    const mapsApiKey = process.env.CEQ_GOOGLE_MAPS_API_KEY

    const apiDisabled = errText.includes('SERVICE_DISABLED') || errText.includes('has not been used') || errText.includes('is disabled')
    if (apiDisabled && placeId && mapsApiKey) {
      logger.info({ sourceId: ctx.sourceId, placeId }, 'google.falling_back_to_places_api')
      const placesResult = await fetchViaPlacesApi(ctx, placeId, mapsApiKey, locationId)
      return { ...placesResult, updatedCredentials: updatedCredentials ?? placesResult.updatedCredentials }
    }

    throw new ConnectorAuthError('Google', `HTTP 403: ${errText.slice(0, 200)}`, updatedCredentials)
  }

  if (!rawResponse.ok) {
    const text = await rawResponse.text().catch(() => '')
    throw new Error(`[Google] HTTP ${rawResponse.status}: ${text.slice(0, 200)}`)
  }

  const data = (await rawResponse.json()) as GoogleReviewsResponse
  const reviews = data.reviews ?? []

  logger.info(
    { sourceId: ctx.sourceId, count: reviews.length, hasMore: !!data.nextPageToken },
    'google.reviews_fetched',
  )

  const deliveries = reviews.map((review) => ({
    externalId: review.reviewId,
    body: review.comment ?? '',
    rating: STAR_RATING_MAP[review.starRating] ?? null,
    externalAuthorLabel: review.reviewer?.displayName ?? null,
    canonicalUrl: `https://search.google.com/local/reviews?placeid=${encodeURIComponent(locationId)}`,
    postedAt: review.createTime,
    subjectType: 'location',
    subjectKey: locationId,
    subjectLabel: (ctx.scopeConfig.locationLabel as string) ?? locationId,
    providerStatus: 'visible',
    providerMetadata: {
      reviewReply: review.reviewReply ?? null,
      name: review.name,
      totalReviewCount: data.totalReviewCount,
      averageRating: data.averageRating,
    },
    rawPayload: review,
  }))

  return {
    deliveries,
    nextCursor: data.nextPageToken ? { pageToken: data.nextPageToken } : null,
    updatedCredentials,
  }
}
