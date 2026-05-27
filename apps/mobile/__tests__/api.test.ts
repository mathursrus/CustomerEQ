/**
 * Unit tests for lib/api.ts pure helpers.
 * These run without React Native or env mocking — all inputs are explicit.
 */
import { buildQueryEnabled, buildApiHeaders } from '../lib/api'

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
  const base = { devBypass: false, devToken: 'dev-bypass' }

  it('returns Bearer dev-bypass when devBypass is true', async () => {
    const headers = await buildApiHeaders({ ...base, devBypass: true }) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer dev-bypass')
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
