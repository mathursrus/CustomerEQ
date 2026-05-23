import pino from 'pino'
import {
  type ConnectorContext,
  type ConnectorResult,
  connectorFetch,
  getCredentials,
  mergeEnvCredentials,
  isTokenExpired,
  refreshOAuthToken,
  ConnectorAuthError,
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

  // accountId = "accounts/{id}", locationId = "locations/{id}" (from Business Information API).
  // Reviews API v1 parent format: "accounts/{id}/locations/{id}" — compose from both fields.
  const url = `https://mybusinessreviews.googleapis.com/v1/${accountId}/${locationId}/reviews?${params}`

  const response = await connectorFetch('Google', url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
    },
  })

  const data = (await response.json()) as GoogleReviewsResponse
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
