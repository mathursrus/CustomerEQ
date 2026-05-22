/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchGoogleBusinessProfileReviews } from './google.js'
import { ConnectorAuthError, ConnectorRateLimitError } from './types.js'

const mockFetch = vi.fn()

describe('fetchGoogleBusinessProfileReviews', () => {
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
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
        clientId: 'google-client',
        clientSecret: 'google-secret',
      },
      accountId: 'accounts/123',
      locationId: 'locations/456',
      locationLabel: 'Flagship Store',
    },
  }

  it('fetches reviews and maps fields correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reviews: [
          {
            reviewId: 'review-1',
            reviewer: { displayName: 'John D.' },
            starRating: 'FOUR',
            comment: 'Great service but slow pickup.',
            createTime: '2026-04-07T10:00:00Z',
            name: 'accounts/123/locations/456/reviews/review-1',
          },
        ],
        nextPageToken: 'page2',
        totalReviewCount: 150,
        averageRating: 4.2,
      }),
      headers: new Map(),
    })

    const result = await fetchGoogleBusinessProfileReviews(baseCtx)

    expect(result.deliveries).toHaveLength(1)
    expect(result.deliveries[0]).toEqual(expect.objectContaining({
      externalId: 'review-1',
      body: 'Great service but slow pickup.',
      rating: 4,
      externalAuthorLabel: 'John D.',
      postedAt: '2026-04-07T10:00:00Z',
      subjectType: 'location',
      subjectKey: 'locations/456',
      subjectLabel: 'Flagship Store',
    }))
    expect(result.nextCursor).toEqual({ pageToken: 'page2' })
  })

  it('refreshes OAuth token when expired', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: {
        ...baseCtx.scopeConfig,
        credentials: {
          ...baseCtx.scopeConfig.credentials,
          tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    }

    // Token refresh call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      }),
    })
    // Reviews API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviews: [] }),
      headers: new Map(),
    })

    const result = await fetchGoogleBusinessProfileReviews(ctx)

    expect(result.updatedCredentials).toBeDefined()
    expect((result.updatedCredentials as Record<string, unknown>).accessToken).toBe('new-access-token')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ConnectorAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Invalid credentials',
      headers: new Map(),
    })

    await expect(fetchGoogleBusinessProfileReviews(baseCtx)).rejects.toThrow(ConnectorAuthError)
  })

  it('throws ConnectorRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Quota exceeded',
      headers: new Headers({ 'retry-after': '30' }),
    })

    await expect(fetchGoogleBusinessProfileReviews(baseCtx)).rejects.toThrow(ConnectorRateLimitError)
  })

  it('uses pageToken cursor for pagination', async () => {
    const ctx = {
      ...baseCtx,
      lastCursor: { pageToken: 'existing-cursor' },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviews: [] }),
      headers: new Map(),
    })

    await fetchGoogleBusinessProfileReviews(ctx)

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('pageToken=existing-cursor')
  })

  it('throws when accountId or locationId missing', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: { ...baseCtx.scopeConfig, accountId: undefined, locationId: undefined },
    }

    await expect(fetchGoogleBusinessProfileReviews(ctx)).rejects.toThrow('Missing accountId or locationId')
  })

  it('throws ConnectorAuthError when no credentials and no env vars', async () => {
    delete process.env.CEQ_GOOGLE_CLIENT_ID
    delete process.env.CEQ_GOOGLE_CLIENT_SECRET
    const ctx = { ...baseCtx, scopeConfig: { accountId: 'a', locationId: 'l' } }

    await expect(fetchGoogleBusinessProfileReviews(ctx)).rejects.toThrow(ConnectorAuthError)
  })

  it('merges env var clientId/clientSecret when scopeConfig only has tokens', async () => {
    process.env.CEQ_GOOGLE_CLIENT_ID = 'env-google-client'
    process.env.CEQ_GOOGLE_CLIENT_SECRET = 'env-google-secret'

    const ctx = {
      ...baseCtx,
      scopeConfig: {
        credentials: {
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
          tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          // No clientId/clientSecret — should come from env
        },
        accountId: 'accounts/123',
        locationId: 'locations/456',
      },
    }

    // Token refresh (should use env var client credentials)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'refreshed', refresh_token: 'new-refresh', expires_in: 3600 }),
    })
    // Reviews fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviews: [] }),
      headers: new Map(),
    })

    const result = await fetchGoogleBusinessProfileReviews(ctx)

    // Token refresh call should include the env var credentials
    const refreshBody = mockFetch.mock.calls[0][1]?.body as string
    expect(refreshBody).toContain('client_id=env-google-client')
    expect(refreshBody).toContain('client_secret=env-google-secret')
    expect(result.updatedCredentials).toBeDefined()

    delete process.env.CEQ_GOOGLE_CLIENT_ID
    delete process.env.CEQ_GOOGLE_CLIENT_SECRET
  })

  it('calls the real API even when CEQ_MOCK_GOOGLE_REVIEWS is set', async () => {
    // Regression guard: once mock mode is removed, this env var must have no effect.
    // If the env var still short-circuits to mock data, fetch is never called and
    // the test fails — proving the mock bypass is not gone.
    const original = process.env.CEQ_MOCK_GOOGLE_REVIEWS
    try {
      process.env.CEQ_MOCK_GOOGLE_REVIEWS = 'true'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reviews: [] }),
        headers: new Map(),
      })

      await fetchGoogleBusinessProfileReviews(baseCtx)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    } finally {
      if (original === undefined) {
        delete process.env.CEQ_MOCK_GOOGLE_REVIEWS
      } else {
        process.env.CEQ_MOCK_GOOGLE_REVIEWS = original
      }
    }
  })

  it('maps all star rating values correctly', async () => {
    const reviews = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].map((star, i) => ({
      reviewId: `review-${i}`,
      reviewer: { displayName: `User ${i}` },
      starRating: star,
      comment: `Review ${star}`,
      createTime: '2026-04-07T10:00:00Z',
      name: `accounts/123/locations/456/reviews/review-${i}`,
    }))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviews }),
      headers: new Map(),
    })

    const result = await fetchGoogleBusinessProfileReviews(baseCtx)

    expect(result.deliveries.map((d) => d.rating)).toEqual([1, 2, 3, 4, 5])
  })
})
