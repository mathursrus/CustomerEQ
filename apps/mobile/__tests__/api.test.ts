/**
 * Unit tests for lib/api.ts pure helpers.
 * These run without React Native or env mocking — all inputs are explicit.
 */
import { buildQueryEnabled, buildApiHeaders } from '../lib/api'

describe('buildQueryEnabled', () => {
  it('returns true when mobileApiKey is set, regardless of sign-in state', () => {
    expect(buildQueryEnabled({ mobileApiKey: 'ceq_abc', devBypass: false, isSignedIn: false })).toBe(true)
    expect(buildQueryEnabled({ mobileApiKey: 'ceq_abc', devBypass: false, isSignedIn: true })).toBe(true)
  })

  it('returns true when devBypass is true, regardless of sign-in state', () => {
    expect(buildQueryEnabled({ mobileApiKey: '', devBypass: true, isSignedIn: false })).toBe(true)
  })

  it('returns true only when signed in (no key, no bypass)', () => {
    expect(buildQueryEnabled({ mobileApiKey: '', devBypass: false, isSignedIn: false })).toBe(false)
    expect(buildQueryEnabled({ mobileApiKey: '', devBypass: false, isSignedIn: true })).toBe(true)
  })

  it('returns false when all flags are off and not signed in', () => {
    expect(buildQueryEnabled({ mobileApiKey: '', devBypass: false, isSignedIn: false })).toBe(false)
  })
})

describe('buildApiHeaders', () => {
  const base = { devBypass: false, devToken: 'dev-bypass' }

  it('returns X-Api-Key header when mobileApiKey is set', async () => {
    const headers = await buildApiHeaders({ ...base, mobileApiKey: 'ceq_test_key' }) as Record<string, string>
    expect(headers['X-Api-Key']).toBe('ceq_test_key')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('does not call getToken when mobileApiKey is set', async () => {
    const getToken = jest.fn().mockResolvedValue('should-not-be-called')
    await buildApiHeaders({ ...base, mobileApiKey: 'ceq_test_key', getToken })
    expect(getToken).not.toHaveBeenCalled()
  })

  it('returns Bearer dev-bypass when devBypass is true and no API key', async () => {
    const headers = await buildApiHeaders({ ...base, mobileApiKey: '', devBypass: true }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer dev-bypass')
  })

  it('calls getToken and returns Bearer <token> for real Clerk auth', async () => {
    const getToken = jest.fn().mockResolvedValue('clerk_jwt_xyz')
    const headers = await buildApiHeaders({ ...base, mobileApiKey: '', getToken }) as Record<string, string>
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(headers['Authorization']).toBe('Bearer clerk_jwt_xyz')
  })

  it('returns Bearer empty string when getToken returns null', async () => {
    const getToken = jest.fn().mockResolvedValue(null)
    const headers = await buildApiHeaders({ ...base, mobileApiKey: '', getToken }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ')
  })

  it('returns Bearer empty string when getToken is not provided', async () => {
    const headers = await buildApiHeaders({ ...base, mobileApiKey: '' }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ')
  })

  it('mobileApiKey takes precedence over devBypass', async () => {
    const headers = await buildApiHeaders({ ...base, mobileApiKey: 'ceq_key', devBypass: true }) as Record<string, string>
    expect(headers['X-Api-Key']).toBe('ceq_key')
    expect(headers['Authorization']).toBeUndefined()
  })
})
