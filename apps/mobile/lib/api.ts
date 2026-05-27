export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
export const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
export const DEV_TOKEN = 'dev-bypass'
// When set, API calls use X-Api-Key instead of a Clerk JWT.
// Required for TestFlight because the test Clerk instance (oriole) issues JWTs
// that the production API rejects — they come from different Clerk instances.
export const MOBILE_API_KEY = process.env.EXPO_PUBLIC_MOBILE_API_KEY?.trim() ?? ''

// Pure helper — testable without module resets.
export function buildQueryEnabled(opts: {
  mobileApiKey: string
  devBypass: boolean
  isSignedIn: boolean
}): boolean {
  return !!opts.mobileApiKey || opts.devBypass || opts.isSignedIn
}

// Pure helper — testable without module resets.
export async function buildApiHeaders(opts: {
  mobileApiKey: string
  devBypass: boolean
  devToken: string
  getToken?: (() => Promise<string | null>) | null
}): Promise<HeadersInit> {
  if (opts.mobileApiKey) return { 'X-Api-Key': opts.mobileApiKey }
  if (opts.devBypass) return { Authorization: `Bearer ${opts.devToken}` }
  const token = await opts.getToken?.()
  return { Authorization: `Bearer ${token ?? ''}` }
}

// Convenience wrappers using the module-level constants (used by hooks).
export function queryEnabled(isSignedIn: boolean): boolean {
  return buildQueryEnabled({ mobileApiKey: MOBILE_API_KEY, devBypass: DEV_BYPASS, isSignedIn })
}

export async function apiHeaders(
  getToken: (() => Promise<string | null>) | null | undefined,
): Promise<HeadersInit> {
  return buildApiHeaders({ mobileApiKey: MOBILE_API_KEY, devBypass: DEV_BYPASS, devToken: DEV_TOKEN, getToken })
}
