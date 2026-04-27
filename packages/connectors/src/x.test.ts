/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchXSearchResults } from './x.js'
import { ConnectorAuthError, ConnectorRateLimitError } from './types.js'

const mockFetch = vi.fn()

describe('fetchXSearchResults', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    delete process.env.CEQ_X_BEARER_TOKEN
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
      credentials: { bearerToken: 'test-bearer-token' },
      searchQuery: '"CustomerEQ" -is:retweet',
    },
  }

  it('fetches tweets and maps them correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: '123456789',
            text: 'Just tried CustomerEQ, amazing platform!',
            author_id: '987654321',
            created_at: '2026-04-07T15:00:00.000Z',
            public_metrics: { retweet_count: 5, reply_count: 2, like_count: 42, quote_count: 1 },
          },
        ],
        meta: { newest_id: '123456789', result_count: 1, next_token: 'next-page' },
      }),
      headers: new Map(),
    })

    const result = await fetchXSearchResults(baseCtx)

    expect(result.deliveries).toHaveLength(1)
    expect(result.deliveries[0]).toEqual(expect.objectContaining({
      externalId: '123456789',
      body: 'Just tried CustomerEQ, amazing platform!',
      externalAuthorHandle: '987654321',
      canonicalUrl: 'https://twitter.com/i/status/123456789',
      postedAt: '2026-04-07T15:00:00.000Z',
      subjectType: 'search_result',
    }))
    expect(result.nextCursor).toEqual({
      sinceId: '123456789',
      nextToken: 'next-page',
    })
  })

  it('returns empty deliveries when no bearer token (graceful degradation)', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: { searchQuery: 'test' },
    }

    const result = await fetchXSearchResults(ctx)

    expect(result.deliveries).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses env var CEQ_X_BEARER_TOKEN as fallback', async () => {
    process.env.CEQ_X_BEARER_TOKEN = 'env-bearer-token'

    const ctx = {
      ...baseCtx,
      scopeConfig: { searchQuery: '"test"' },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { result_count: 0 } }),
      headers: new Map(),
    })

    await fetchXSearchResults(ctx)

    const callHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(callHeaders.Authorization).toBe('Bearer env-bearer-token')
  })

  it('throws ConnectorAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
      headers: new Map(),
    })

    await expect(fetchXSearchResults(baseCtx)).rejects.toThrow(ConnectorAuthError)
  })

  it('throws ConnectorRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
      headers: new Headers({ 'retry-after': '900' }),
    })

    await expect(fetchXSearchResults(baseCtx)).rejects.toThrow(ConnectorRateLimitError)
  })

  it('uses sinceId cursor to fetch only new tweets', async () => {
    const ctx = {
      ...baseCtx,
      lastCursor: { sinceId: '100000', nextToken: null },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { result_count: 0 } }),
      headers: new Map(),
    })

    await fetchXSearchResults(ctx)

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('since_id=100000')
  })

  it('throws when searchQuery is missing', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: { credentials: { bearerToken: 'token' } },
    }

    await expect(fetchXSearchResults(ctx)).rejects.toThrow('Missing searchQuery')
  })
})
