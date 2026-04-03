import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch } from './api-client.js'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs the correct URL with path', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/v1/programs')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/programs'),
      expect.any(Object),
    )
  })

  it('appends query params when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/v1/events', { params: { page: '1', pageSize: '10' } })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('page=1')
    expect(calledUrl).toContain('pageSize=10')
  })

  it('returns ok: true for successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '123' }),
    }))

    const result = await apiFetch('/v1/campaigns/123')
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ id: '123' })
  })

  it('returns ok: false for error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    }))

    const result = await apiFetch('/v1/missing')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(result.error).toBe('Not found')
  })

  it('handles network errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const result = await apiFetch('/v1/programs')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.error).toBe('ECONNREFUSED')
  })

  it('sends JSON body for POST requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 'new' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/v1/programs', {
      method: 'POST',
      body: { name: 'My Program' },
    })

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ name: 'My Program' }))
  })
})
