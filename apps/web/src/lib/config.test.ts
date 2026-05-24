import { afterEach, describe, expect, it, vi } from 'vitest'

async function importConfig() {
  vi.resetModules()
  return import('./config')
}

describe('getAuthToken', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it('returns null immediately during Playwright auth bypass', async () => {
    process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST = 'true'
    const getToken = vi.fn(() => new Promise<string | null>(() => {}))
    const { getAuthToken } = await importConfig()

    await expect(getAuthToken(getToken, 10_000)).resolves.toBeNull()
    expect(getToken).not.toHaveBeenCalled()
  })

  it('returns the Clerk token during normal runtime', async () => {
    delete process.env.PLAYWRIGHT_TEST
    delete process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST
    delete process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH
    const getToken = vi.fn(async () => 'test-token')
    const { getAuthToken } = await importConfig()

    await expect(getAuthToken(getToken, 10_000)).resolves.toBe('test-token')
    expect(getToken).toHaveBeenCalledOnce()
  })
})
