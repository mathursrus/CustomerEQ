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

// Mock reviews returned when CEQ_MOCK_GOOGLE_REVIEWS=true (used while waiting for
// Google Business Profile API quota approval — remove this block once approved).
const MOCK_REVIEWS: GoogleReview[] = [
  {
    reviewId: 'mock-review-1',
    reviewer: { displayName: 'Sarah K.' },
    starRating: 'FIVE',
    comment: 'Best meal we have had in Bellevue! The chef came out to greet us and the service was impeccable.',
    createTime: '2026-04-09T18:30:00Z',
    name: 'mock/locations/skb-bellevue/reviews/mock-review-1',
  },
  {
    reviewId: 'mock-review-2',
    reviewer: { displayName: 'Michael R.' },
    starRating: 'FOUR',
    comment: 'Great food and ambience. Slightly long wait for the table even with a reservation, but worth it.',
    createTime: '2026-04-08T20:15:00Z',
    name: 'mock/locations/skb-bellevue/reviews/mock-review-2',
  },
  {
    reviewId: 'mock-review-3',
    reviewer: { displayName: 'Anonymous' },
    starRating: 'THREE',
    comment: 'Food was good but the noise level made it hard to have a conversation. Loud kitchen sounds.',
    createTime: '2026-04-07T19:00:00Z',
    name: 'mock/locations/skb-bellevue/reviews/mock-review-3',
  },
  {
    reviewId: 'mock-review-4',
    reviewer: { displayName: 'Jennifer L.' },
    starRating: 'FIVE',
    comment: 'Absolutely loved the tasting menu. Will definitely be back for our anniversary!',
    createTime: '2026-04-06T21:45:00Z',
    name: 'mock/locations/skb-bellevue/reviews/mock-review-4',
  },
  {
    reviewId: 'mock-review-5',
    reviewer: { displayName: 'David T.' },
    starRating: 'TWO',
    comment: 'Disappointing experience. Order was wrong twice and the manager was not helpful in resolving it.',
    createTime: '2026-04-05T19:30:00Z',
    name: 'mock/locations/skb-bellevue/reviews/mock-review-5',
  },
]

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

  // Mock mode: return sample reviews instead of calling Google API
  // Used while waiting for Google Business Profile API quota approval
  if (process.env.CEQ_MOCK_GOOGLE_REVIEWS === 'true') {
    logger.info({ sourceId: ctx.sourceId, mock: true }, 'google.mock_mode')
    const deliveries = MOCK_REVIEWS.map((review) => ({
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
      providerMetadata: { reviewReply: null, name: review.name, mock: true },
      rawPayload: review as unknown as Record<string, unknown>,
    }))
    return { deliveries, nextCursor: null }
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

  const url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?${params}`

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
