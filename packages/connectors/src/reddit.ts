import pino from 'pino'
import {
  type ConnectorContext,
  type ConnectorResult,
  connectorFetch,
  ConnectorAuthError,
  isTokenExpired,
} from './types.js'

const logger = pino({ name: 'connector:reddit' })

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const REDDIT_API_BASE = 'https://oauth.reddit.com'
const USER_AGENT = 'CustomerEQ/1.0 (external-signal-sync)'

interface RedditCredentials {
  clientId: string
  clientSecret: string
  accessToken?: string
  tokenExpiresAt?: string
}

interface RedditPost {
  name: string
  title: string
  selftext: string
  author: string
  subreddit: string
  permalink: string
  created_utc: number
  score: number
  num_comments: number
  url: string
  is_self: boolean
}

interface RedditListingResponse {
  data: {
    children: Array<{ data: RedditPost }>
    after: string | null
  }
}

function getRedditCredentials(scopeConfig: Record<string, unknown>): RedditCredentials | null {
  const creds = scopeConfig.credentials as Record<string, unknown> | undefined
  const clientId = (creds?.clientId as string) || process.env.CEQ_REDDIT_CLIENT_ID || ''
  const clientSecret = (creds?.clientSecret as string) || process.env.CEQ_REDDIT_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) return null
  return {
    clientId,
    clientSecret,
    accessToken: creds?.accessToken as string | undefined,
    tokenExpiresAt: creds?.tokenExpiresAt as string | undefined,
  }
}

async function getRedditAppToken(credentials: RedditCredentials): Promise<{
  accessToken: string
  expiresAt: string
}> {
  const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ConnectorAuthError('Reddit', `Token request failed: HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  const expiresIn = (data.expires_in as number) ?? 3600

  return {
    accessToken: data.access_token as string,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}

export async function fetchRedditPosts(ctx: ConnectorContext): Promise<ConnectorResult> {
  const credentials = getRedditCredentials(ctx.scopeConfig)
  if (!credentials) {
    throw new ConnectorAuthError('Reddit', 'No credentials configured (clientId + clientSecret required)')
  }

  let updatedCredentials: Record<string, unknown> | undefined

  // Get or refresh app-only token (no accessToken means we need to fetch a fresh one)
  if (!credentials.accessToken || isTokenExpired({ accessToken: credentials.accessToken, tokenExpiresAt: credentials.tokenExpiresAt }, 60_000)) {
    const token = await getRedditAppToken(credentials)
    credentials.accessToken = token.accessToken
    credentials.tokenExpiresAt = token.expiresAt
    updatedCredentials = { ...credentials }
  }

  const mode = (ctx.scopeConfig.mode as string) ?? 'subreddit'
  const subreddits = (ctx.scopeConfig.subreddits as string[]) ?? []
  const keywords = (ctx.scopeConfig.keywords as string[]) ?? []
  const cursor = ctx.lastCursor as { after?: string } | null

  const headers = {
    Authorization: `Bearer ${credentials.accessToken}`,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  }

  let allDeliveries: Record<string, unknown>[] = []
  let nextAfter: string | null = null

  if (mode === 'search' && keywords.length > 0) {
    // Search mode: search across all of Reddit
    const query = keywords.join(' OR ')
    const params = new URLSearchParams({
      q: query,
      sort: 'new',
      limit: '100',
      restrict_sr: 'false',
      type: 'link',
    })
    if (cursor?.after) params.set('after', cursor.after)

    const url = `${REDDIT_API_BASE}/search?${params}`
    const response = await connectorFetch('Reddit', url, { headers })
    const data = (await response.json()) as RedditListingResponse

    allDeliveries = data.data.children.map((child) => mapRedditPost(child.data))
    nextAfter = data.data.after
  } else {
    // Note: cursor.after is per-subreddit in Reddit's API — reusing a shared cursor
    // across subreddits is semantically wrong, so it's not passed here. Per-subreddit
    // cursors would need to be a map in scopeConfig.lastCursor.
    const subredditResults = await Promise.all(
      subreddits.map(async (subreddit) => {
        const params = new URLSearchParams({ limit: '50', sort: 'new' })
        const url = `${REDDIT_API_BASE}/r/${encodeURIComponent(subreddit)}/new?${params}`
        const response = await connectorFetch('Reddit', url, { headers })
        return (await response.json()) as RedditListingResponse
      }),
    )

    const lowerKeywords = keywords.map((k) => k.toLowerCase())
    for (const data of subredditResults) {
      const posts = data.data.children.map((child) => mapRedditPost(child.data))
      if (lowerKeywords.length > 0) {
        allDeliveries.push(
          ...posts.filter((post) => {
            const text = `${post.body as string} ${post.summary as string}`.toLowerCase()
            return lowerKeywords.some((kw) => text.includes(kw))
          }),
        )
      } else {
        allDeliveries.push(...posts)
      }
      if (data.data.after) nextAfter = data.data.after
    }
  }

  logger.info(
    { sourceId: ctx.sourceId, count: allDeliveries.length, mode },
    'reddit.posts_fetched',
  )

  return {
    deliveries: allDeliveries,
    nextCursor: nextAfter ? { after: nextAfter } : null,
    updatedCredentials,
  }
}

function mapRedditPost(post: RedditPost): Record<string, unknown> {
  return {
    externalId: post.name,
    body: post.is_self ? post.selftext : post.title,
    summary: post.title,
    externalAuthorHandle: `u/${post.author}`,
    externalAuthorLabel: `u/${post.author}`,
    canonicalUrl: `https://reddit.com${post.permalink}`,
    postedAt: new Date(post.created_utc * 1000).toISOString(),
    subjectType: 'subreddit',
    subjectKey: post.subreddit,
    subjectLabel: `r/${post.subreddit}`,
    providerStatus: 'visible',
    providerMetadata: {
      score: post.score,
      numComments: post.num_comments,
      url: post.url,
    },
    rawPayload: post,
  }
}
