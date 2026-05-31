/**
 * Unit tests for lib/api.ts pure helpers.
 * These run without React Native or env mocking — all inputs are explicit.
 */
import { buildQueryEnabled, buildApiHeaders, resolveDevBypass } from '../lib/api'

describe('resolveDevBypass', () => {
  it('allows dev bypass only in development', () => {
    expect(resolveDevBypass('true', true)).toBe(true)
    expect(resolveDevBypass(' true ', true)).toBe(true)
  })

  it('suppresses dev bypass in production bundles even when env is true', () => {
    expect(resolveDevBypass('true', false)).toBe(false)
  })

  it('stays off when env is missing or false', () => {
    expect(resolveDevBypass(undefined, true)).toBe(false)
    expect(resolveDevBypass('false', true)).toBe(false)
  })
})

describe('buildQueryEnabled', () => {
  it('returns true when devBypass is true, regardless of sign-in state', () => {
    expect(buildQueryEnabled({ devBypass: true, isSignedIn: false })).toBe(true)
    expect(buildQueryEnabled({ devBypass: true, isSignedIn: true })).toBe(true)
  })

  it('returns true only when signed in (no bypass)', () => {
    expect(buildQueryEnabled({ devBypass: false, isSignedIn: false })).toBe(false)
    expect(buildQueryEnabled({ devBypass: false, isSignedIn: true })).toBe(true)
  })

  it('returns false when all flags are off', () => {
    expect(buildQueryEnabled({ devBypass: false, isSignedIn: false })).toBe(false)
  })
})

describe('buildApiHeaders', () => {
  const base = { devBypass: false, devApiKey: 'ceq_testkey' }

  it('returns x-api-key header when devBypass is true', async () => {
    const headers = await buildApiHeaders({ ...base, devBypass: true }) as Record<string, string>
    expect(headers['x-api-key']).toBe('ceq_testkey')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('calls getToken and returns Bearer <token> for real Clerk auth', async () => {
    const getToken = jest.fn().mockResolvedValue('clerk_jwt_xyz')
    const headers = await buildApiHeaders({ ...base, getToken }) as Record<string, string>
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(headers['Authorization']).toBe('Bearer clerk_jwt_xyz')
  })

  it('returns Bearer empty string when getToken returns null', async () => {
    const getToken = jest.fn().mockResolvedValue(null)
    const headers = await buildApiHeaders({ ...base, getToken }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ')
  })

  it('returns Bearer empty string when getToken is not provided', async () => {
    const headers = await buildApiHeaders({ ...base }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ')
  })
})
