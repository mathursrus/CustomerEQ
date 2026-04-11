import pino from 'pino'
import {
  type ConnectorContext,
  type ConnectorResult,
  connectorFetch,
  ConnectorAuthError,
} from './types.js'

const logger = pino({ name: 'connector:x' })

const X_SEARCH_URL = 'https://api.twitter.com/2/tweets/search/recent'

interface XTweet {
  id: string
  text: string
  author_id?: string
  created_at?: string
  public_metrics?: {
    retweet_count: number
    reply_count: number
    like_count: number
    quote_count: number
  }
}

interface XSearchResponse {
  data?: XTweet[]
  meta?: {
    newest_id?: string
    oldest_id?: string
    result_count?: number
    next_token?: string
  }
}

export async function fetchXSearchResults(ctx: ConnectorContext): Promise<ConnectorResult> {
  const creds = ctx.scopeConfig.credentials as Record<string, unknown> | undefined
  const bearerToken = (creds?.bearerToken as string) ?? process.env.CEQ_X_BEARER_TOKEN ?? ''

  if (!bearerToken) {
    // Graceful degradation per RFC — X is behind generic webhook fallback if no credentials
    logger.warn({ sourceId: ctx.sourceId }, 'x.no_bearer_token — returning empty results')
    return { deliveries: [], nextCursor: null }
  }

  const searchQuery = ctx.scopeConfig.searchQuery as string | undefined
  if (!searchQuery) {
    throw new Error('[X] Missing searchQuery in scopeConfig')
  }

  const cursor = ctx.lastCursor as { sinceId?: string; nextToken?: string } | null

  const params = new URLSearchParams({
    query: searchQuery,
    'tweet.fields': 'created_at,author_id,public_metrics',
    max_results: '100',
  })
  if (cursor?.sinceId) params.set('since_id', cursor.sinceId)
  if (cursor?.nextToken) params.set('next_token', cursor.nextToken)

  const url = `${X_SEARCH_URL}?${params}`

  const response = await connectorFetch('X', url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    },
  })

  const data = (await response.json()) as XSearchResponse
  const tweets = data.data ?? []

  logger.info(
    { sourceId: ctx.sourceId, count: tweets.length, hasMore: !!data.meta?.next_token },
    'x.tweets_fetched',
  )

  const deliveries = tweets.map((tweet) => ({
    externalId: tweet.id,
    body: tweet.text,
    externalAuthorHandle: tweet.author_id ?? null,
    canonicalUrl: `https://twitter.com/i/status/${tweet.id}`,
    postedAt: tweet.created_at ?? null,
    subjectType: 'search_result',
    subjectKey: searchQuery,
    subjectLabel: searchQuery,
    providerStatus: 'visible',
    providerMetadata: {
      publicMetrics: tweet.public_metrics ?? null,
    },
    rawPayload: tweet,
  }))

  return {
    deliveries,
    nextCursor: data.meta
      ? {
          sinceId: data.meta.newest_id ?? cursor?.sinceId ?? null,
          nextToken: data.meta.next_token ?? null,
        }
      : null,
  }
}
