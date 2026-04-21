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

const logger = pino({ name: 'connector:linkedin' })

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest'
const LINKEDIN_VERSION = '202401'

interface LinkedInPost {
  id: string
  lifecycleState: string
  publishedAt?: number
  commentary?: string
}

interface LinkedInComment {
  id: string
  actor: string
  message?: { text: string }
  created?: { time: number }
  $URN?: string
}

interface LinkedInPostsResponse {
  elements: LinkedInPost[]
  paging?: { start: number; count: number; total: number }
}

interface LinkedInCommentsResponse {
  elements: LinkedInComment[]
  paging?: { start: number; count: number; total: number }
}

function linkedInHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    Accept: 'application/json',
  }
}

export async function fetchLinkedInComments(ctx: ConnectorContext): Promise<ConnectorResult> {
  const credentials = mergeEnvCredentials(getCredentials(ctx.scopeConfig), 'LINKEDIN')
  if (!credentials || !credentials.accessToken) {
    throw new ConnectorAuthError('LinkedIn', 'No credentials configured — connect via OAuth or set CEQ_LINKEDIN_CLIENT_ID/CEQ_LINKEDIN_CLIENT_SECRET env vars')
  }

  const organizationUrn = ctx.scopeConfig.organizationUrn as string | undefined
  if (!organizationUrn) {
    throw new Error('[LinkedIn] Missing organizationUrn in scopeConfig')
  }

  let updatedCredentials: Record<string, unknown> | undefined

  // Refresh token if expired
  if (isTokenExpired(credentials)) {
    const refreshed = await refreshOAuthToken({
      provider: 'LinkedIn',
      tokenUrl: LINKEDIN_TOKEN_URL,
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

  const cursor = ctx.lastCursor as { lastPostFetchedAt?: string; commentStart?: number } | null
  const headers = linkedInHeaders(credentials.accessToken)

  // Pass 1: Fetch recent posts by the organization
  const postsParams = new URLSearchParams({
    author: organizationUrn,
    q: 'author',
    count: '20',
    sortBy: 'LAST_MODIFIED',
  })

  const postsUrl = `${LINKEDIN_API_BASE}/posts?${postsParams}`
  const postsResponse = await connectorFetch('LinkedIn', postsUrl, { headers })
  const postsData = (await postsResponse.json()) as LinkedInPostsResponse
  const posts = postsData.elements ?? []

  // Filter to posts newer than our last fetch (if we have a cursor)
  const lastFetchedAt = cursor?.lastPostFetchedAt
    ? new Date(cursor.lastPostFetchedAt).getTime()
    : 0

  const newPosts = posts.filter(
    (post) => (post.publishedAt ?? 0) > lastFetchedAt,
  )

  // Pass 2: Fetch comments for all new posts in parallel
  const postCommentResults = await Promise.all(
    newPosts.map(async (post) => {
      const postUrn = encodeURIComponent(post.id)
      const commentsUrl = `${LINKEDIN_API_BASE}/socialActions/${postUrn}/comments?count=50`
      try {
        const commentsResponse = await connectorFetch('LinkedIn', commentsUrl, { headers })
        const commentsData = (await commentsResponse.json()) as LinkedInCommentsResponse
        return { post, comments: commentsData.elements ?? [] }
      } catch (err) {
        logger.warn({ postId: post.id, err }, 'linkedin.comments_fetch_failed')
        return { post, comments: [] as LinkedInComment[] }
      }
    }),
  )

  const allDeliveries: Record<string, unknown>[] = []
  for (const { post, comments } of postCommentResults) {
    for (const comment of comments) {
      allDeliveries.push({
        externalId: comment.id ?? comment.$URN ?? `${post.id}-comment-${allDeliveries.length}`,
        body: comment.message?.text ?? '',
        externalAuthorHandle: comment.actor,
        canonicalUrl: `https://www.linkedin.com/feed/update/${post.id}`,
        postedAt: comment.created?.time ? new Date(comment.created.time).toISOString() : null,
        subjectType: 'post',
        subjectKey: post.id,
        subjectLabel: post.commentary?.slice(0, 100) ?? post.id,
        providerStatus: 'visible',
        providerMetadata: {
          organizationUrn,
          postLifecycleState: post.lifecycleState,
        },
        rawPayload: comment,
      })
    }
  }

  // Update cursor to most recent post timestamp
  const newestPostTime = newPosts.reduce(
    (max, post) => Math.max(max, post.publishedAt ?? 0),
    lastFetchedAt,
  )

  logger.info(
    { sourceId: ctx.sourceId, posts: newPosts.length, comments: allDeliveries.length },
    'linkedin.comments_fetched',
  )

  return {
    deliveries: allDeliveries,
    nextCursor: { lastPostFetchedAt: new Date(newestPostTime).toISOString() },
    updatedCredentials,
  }
}
