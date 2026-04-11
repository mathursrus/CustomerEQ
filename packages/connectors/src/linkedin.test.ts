/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchLinkedInComments } from './linkedin.js'
import { ConnectorAuthError, ConnectorRateLimitError } from './types.js'

const mockFetch = vi.fn()

describe('fetchLinkedInComments', () => {
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
        accessToken: 'li-access-token',
        refreshToken: 'li-refresh-token',
        tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
        clientId: 'li-client',
        clientSecret: 'li-secret',
      },
      organizationUrn: 'urn:li:organization:12345',
    },
  }

  it('fetches posts then comments and maps them correctly', async () => {
    // Posts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            id: 'urn:li:share:1001',
            lifecycleState: 'PUBLISHED',
            publishedAt: Date.now(),
            commentary: 'Our latest product update is live!',
          },
        ],
      }),
      headers: new Map(),
    })

    // Comments response for post
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            id: 'urn:li:comment:2001',
            actor: 'urn:li:person:9876',
            message: { text: 'Love this feature!' },
            created: { time: 1712500000000 },
          },
          {
            id: 'urn:li:comment:2002',
            actor: 'urn:li:person:5432',
            message: { text: 'When will it be available in Europe?' },
            created: { time: 1712500100000 },
          },
        ],
      }),
      headers: new Map(),
    })

    const result = await fetchLinkedInComments(baseCtx)

    expect(result.deliveries).toHaveLength(2)
    expect(result.deliveries[0]).toEqual(expect.objectContaining({
      externalId: 'urn:li:comment:2001',
      body: 'Love this feature!',
      externalAuthorHandle: 'urn:li:person:9876',
      subjectType: 'post',
      subjectKey: 'urn:li:share:1001',
    }))
    expect(result.deliveries[1]).toEqual(expect.objectContaining({
      externalId: 'urn:li:comment:2002',
      body: 'When will it be available in Europe?',
    }))
    expect(result.nextCursor).toBeDefined()
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

    // Token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-li-token',
        refresh_token: 'new-li-refresh',
        expires_in: 3600,
      }),
    })
    // Posts response (empty)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
      headers: new Map(),
    })

    const result = await fetchLinkedInComments(ctx)

    expect(result.updatedCredentials).toBeDefined()
    expect((result.updatedCredentials as Record<string, unknown>).accessToken).toBe('new-li-token')
  })

  it('throws ConnectorAuthError on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Insufficient permissions',
      headers: new Map(),
    })

    await expect(fetchLinkedInComments(baseCtx)).rejects.toThrow(ConnectorAuthError)
  })

  it('throws ConnectorRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
      headers: new Headers({ 'retry-after': '120' }),
    })

    await expect(fetchLinkedInComments(baseCtx)).rejects.toThrow(ConnectorRateLimitError)
  })

  it('skips old posts when cursor has lastPostFetchedAt', async () => {
    const ctx = {
      ...baseCtx,
      lastCursor: { lastPostFetchedAt: new Date(Date.now() - 3600_000).toISOString() },
    }

    // Posts response with one old post and one new post
    const oldTime = Date.now() - 7200_000
    const newTime = Date.now()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          { id: 'urn:li:share:old', lifecycleState: 'PUBLISHED', publishedAt: oldTime },
          { id: 'urn:li:share:new', lifecycleState: 'PUBLISHED', publishedAt: newTime, commentary: 'New post' },
        ],
      }),
      headers: new Map(),
    })

    // Comments for the new post only
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          { id: 'urn:li:comment:3001', actor: 'urn:li:person:1', message: { text: 'Nice!' }, created: { time: newTime } },
        ],
      }),
      headers: new Map(),
    })

    const result = await fetchLinkedInComments(ctx)

    // Only 1 comment from the new post (old post was filtered out)
    expect(result.deliveries).toHaveLength(1)
    // Should have called fetch twice: posts + comments for new post only
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ConnectorAuthError when no credentials', async () => {
    const ctx = { ...baseCtx, scopeConfig: { organizationUrn: 'urn:li:org:1' } }
    await expect(fetchLinkedInComments(ctx)).rejects.toThrow(ConnectorAuthError)
  })

  it('throws when organizationUrn is missing', async () => {
    const ctx = {
      ...baseCtx,
      scopeConfig: { credentials: baseCtx.scopeConfig.credentials },
    }
    await expect(fetchLinkedInComments(ctx)).rejects.toThrow('Missing organizationUrn')
  })

  it('sends required LinkedIn API headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
      headers: new Map(),
    })

    await fetchLinkedInComments(baseCtx)

    const callHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(callHeaders['LinkedIn-Version']).toBe('202401')
    expect(callHeaders['X-Restli-Protocol-Version']).toBe('2.0.0')
  })
})
