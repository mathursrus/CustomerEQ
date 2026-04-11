/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchRedditPosts } from './reddit.js'
import { ConnectorAuthError, ConnectorRateLimitError } from './types.js'

const mockFetch = vi.fn()

describe('fetchRedditPosts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const baseCtx = {
    sourceId: 'source-001',
    brandId: 'brand-001',
    credentialRef: null,
    lastCursor: null,
    scopeConfig: {
      credentials: {
        clientId: 'reddit-client',
        clientSecret: 'reddit-secret',
        accessToken: 'valid-token',
        tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
      mode: 'subreddit',
      subreddits: ['CustomerEQ'],
      keywords: [],
    },
  }

  function mockRedditResponse(posts: Record<string, unknown>[], after: string | null = null) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          children: posts.map((p) => ({ data: p })),
          after,
        },
      }),
      headers: new Map(),
    }
  }

  it('fetches posts from a subreddit and maps them correctly', async () => {
    mockFetch.mockResolvedValueOnce(mockRedditResponse([
      {
        name: 't3_abc123',
        title: 'Great product but slow shipping',
        selftext: 'I ordered last week and still waiting.',
        author: 'test_user',
        subreddit: 'CustomerEQ',
        permalink: '/r/CustomerEQ/comments/abc123/great_product/',
        created_utc: 1712500000,
        score: 42,
        num_comments: 5,
        url: 'https://reddit.com/r/CustomerEQ/comments/abc123/great_product/',
        is_self: true,
      },
    ], 't3_next'))

    const result = await fetchRedditPosts(baseCtx)

    expect(result.deliveries).toHaveLength(1)
    expect(result.deliveries[0]).toEqual(expect.objectContaining({
      externalId: 't3_abc123',
      body: 'I ordered last week and still waiting.',
      summary: 'Great product but slow shipping',
      externalAuthorHandle: 'u/test_user',
      subjectType: 'subreddit',
      subjectKey: 'CustomerEQ',
      canonicalUrl: 'https://reddit.com/r/CustomerEQ/comments/abc123/great_product/',
    }))
    expect(result.nextCursor).toEqual({ after: 't3_next' })
  })

  it('refreshes app-only token when expired', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: {
        ...baseCtx.scopeConfig,
        credentials: {
          clientId: 'reddit-client',
          clientSecret: 'reddit-secret',
          accessToken: 'expired-token',
          tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    }

    // First call: token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new-token', expires_in: 3600, token_type: 'bearer' }),
    })
    // Second call: subreddit fetch
    mockFetch.mockResolvedValueOnce(mockRedditResponse([]))

    const result = await fetchRedditPosts(ctx)

    expect(result.updatedCredentials).toBeDefined()
    expect((result.updatedCredentials as Record<string, unknown>).accessToken).toBe('new-token')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ConnectorAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
      headers: new Map(),
    })

    await expect(fetchRedditPosts(baseCtx)).rejects.toThrow(ConnectorAuthError)
  })

  it('throws ConnectorRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
      headers: new Headers({ 'retry-after': '60' }),
    })

    await expect(fetchRedditPosts(baseCtx)).rejects.toThrow(ConnectorRateLimitError)
  })

  it('uses search mode when configured', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: {
        ...baseCtx.scopeConfig,
        mode: 'search',
        keywords: ['CustomerEQ', 'loyalty'],
      },
    }

    mockFetch.mockResolvedValueOnce(mockRedditResponse([
      {
        name: 't3_search1',
        title: 'CustomerEQ review',
        selftext: 'Testing the loyalty platform.',
        author: 'reviewer',
        subreddit: 'SaaS',
        permalink: '/r/SaaS/comments/search1/review/',
        created_utc: 1712500000,
        score: 10,
        num_comments: 2,
        url: 'https://reddit.com/r/SaaS/comments/search1/review/',
        is_self: true,
      },
    ]))

    const result = await fetchRedditPosts(ctx)

    expect(result.deliveries).toHaveLength(1)
    // Verify the search URL was called (not subreddit URL)
    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('/search?')
    expect(callUrl).toContain('CustomerEQ')
  })

  it('throws ConnectorAuthError when no credentials configured and no env vars', async () => {
    delete process.env.CEQ_REDDIT_CLIENT_ID
    delete process.env.CEQ_REDDIT_CLIENT_SECRET
    const ctx = {
      ...baseCtx,
      scopeConfig: { mode: 'subreddit', subreddits: ['test'] },
    }

    await expect(fetchRedditPosts(ctx)).rejects.toThrow(ConnectorAuthError)
  })

  it('falls back to env vars when scopeConfig.credentials is missing', async () => {
    process.env.CEQ_REDDIT_CLIENT_ID = 'env-client-id'
    process.env.CEQ_REDDIT_CLIENT_SECRET = 'env-client-secret'

    const ctx = {
      ...baseCtx,
      scopeConfig: { mode: 'subreddit', subreddits: ['CustomerEQ'], keywords: [] },
    }

    // Token request using env var credentials
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'env-token', expires_in: 3600 }),
    })
    // Subreddit fetch
    mockFetch.mockResolvedValueOnce(mockRedditResponse([]))

    const result = await fetchRedditPosts(ctx)

    expect(result.deliveries).toEqual([])
    // Verify the token request used env var credentials (Basic auth header)
    const tokenCallHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    const expectedAuth = Buffer.from('env-client-id:env-client-secret').toString('base64')
    expect(tokenCallHeaders.Authorization).toBe(`Basic ${expectedAuth}`)

    delete process.env.CEQ_REDDIT_CLIENT_ID
    delete process.env.CEQ_REDDIT_CLIENT_SECRET
  })

  it('uses cursor for pagination in search mode', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: {
        ...baseCtx.scopeConfig,
        mode: 'search',
        keywords: ['CustomerEQ'],
      },
      lastCursor: { after: 't3_previous' },
    }

    mockFetch.mockResolvedValueOnce(mockRedditResponse([]))

    await fetchRedditPosts(ctx)

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('after=t3_previous')
  })

  it('ignores shared cursor in subreddit mode — cursors are per-subreddit', async () => {
    const ctx = {
      ...baseCtx,
      lastCursor: { after: 't3_shared' },
    }

    mockFetch.mockResolvedValueOnce(mockRedditResponse([]))

    await fetchRedditPosts(ctx)

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).not.toContain('after=t3_shared')
  })
})
