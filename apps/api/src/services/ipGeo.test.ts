import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AzureMapsIpGeoProvider,
  NoopIpGeoProvider,
  selectIpGeoProvider,
} from './ipGeo.js'

interface CapturedLog {
  obj: unknown
  msg: string
}

function makeLogger(): { logger: { warn: (o: unknown, m: string) => void }; logs: CapturedLog[] } {
  const logs: CapturedLog[] = []
  return {
    logger: { warn: (obj, msg) => logs.push({ obj, msg }) },
    logs,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AzureMapsIpGeoProvider', () => {
  let logger: { warn: (o: unknown, m: string) => void }
  let logs: CapturedLog[]

  beforeEach(() => {
    const made = makeLogger()
    logger = made.logger
    logs = made.logs
  })

  it('returns the ISO country code on a successful Azure Maps response', async () => {
    const calledUrls: string[] = []
    const fetchMock: typeof globalThis.fetch = async (input) => {
      calledUrls.push(typeof input === 'string' ? input : input.toString())
      return jsonResponse({ countryRegion: { isoCode: 'US' }, ipAddress: '1.2.3.4' })
    }
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBe('US')
    expect(calledUrls).toHaveLength(1)
    expect(calledUrls[0]).toContain('subscription-key=test-key')
    expect(calledUrls[0]).toContain('ip=1.2.3.4')
    expect(logs).toEqual([])
  })

  it('returns null and logs a warn on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => new Response('rate-limited', { status: 429 }))
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.msg).toContain('non-2xx')
  })

  it('returns null and logs a warn on a malformed response (missing isoCode)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ipAddress: '1.2.3.4' }))
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.msg).toContain('malformed')
  })

  it('returns null and logs a warn on a malformed isoCode (lowercase / wrong length)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ countryRegion: { isoCode: 'usa' }, ipAddress: '1.2.3.4' }),
    )
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(logs).toHaveLength(1)
  })

  it('returns null on a fetch error (network failure)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network failure')
    })
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(logs).toHaveLength(1)
  })

  it('returns null on timeout (AbortError)', async () => {
    // Simulate a fetch that never resolves on its own; the provider's
    // internal timeout should abort it.
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      timeoutMs: 10,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(logs.some((l) => (l.obj as { ipCountryReason?: string }).ipCountryReason === 'timeout')).toBe(true)
  })

  it('returns null without making a request when subscriptionKey is null (service disabled)', async () => {
    const fetchMock = vi.fn()
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: null,
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const country = await provider.getCountryFromIp('1.2.3.4')

    expect(country).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logs).toEqual([])
  })

  it('returns null with a warn log on empty / non-string ip', async () => {
    const fetchMock = vi.fn()
    const provider = new AzureMapsIpGeoProvider({
      subscriptionKey: 'test-key',
      logger,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    expect(await provider.getCountryFromIp('')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logs).toHaveLength(1)
  })
})

describe('NoopIpGeoProvider', () => {
  it('returns null for every lookup', async () => {
    const provider = new NoopIpGeoProvider()
    expect(await provider.getCountryFromIp('1.2.3.4')).toBeNull()
    expect(await provider.getCountryFromIp('::1')).toBeNull()
    expect(await provider.getCountryFromIp('')).toBeNull()
  })
})

describe('selectIpGeoProvider', () => {
  it('returns AzureMapsIpGeoProvider when IP_GEO_PROVIDER is unset (default)', () => {
    const { logger } = makeLogger()
    const provider = selectIpGeoProvider({ AZURE_MAPS_KEY: 'test-key' }, logger)
    expect(provider).toBeInstanceOf(AzureMapsIpGeoProvider)
  })

  it('returns AzureMapsIpGeoProvider with disabled subscription when AZURE_MAPS_KEY is missing', async () => {
    const { logger } = makeLogger()
    const provider = selectIpGeoProvider({ IP_GEO_PROVIDER: 'azure-maps' }, logger)
    expect(provider).toBeInstanceOf(AzureMapsIpGeoProvider)
    // Service is constructed but acts as no-op until the key is provisioned.
    expect(await provider.getCountryFromIp('1.2.3.4')).toBeNull()
  })

  it('returns NoopIpGeoProvider when IP_GEO_PROVIDER=noop', () => {
    const { logger } = makeLogger()
    const provider = selectIpGeoProvider({ IP_GEO_PROVIDER: 'noop' }, logger)
    expect(provider).toBeInstanceOf(NoopIpGeoProvider)
  })

  it('returns NoopIpGeoProvider and logs a warn when IP_GEO_PROVIDER is unrecognized', () => {
    const { logger, logs } = makeLogger()
    const provider = selectIpGeoProvider({ IP_GEO_PROVIDER: 'unknown-provider' }, logger)
    expect(provider).toBeInstanceOf(NoopIpGeoProvider)
    expect(logs).toHaveLength(1)
    expect(logs[0]?.msg).toContain('unrecognized')
  })
})
