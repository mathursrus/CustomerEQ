export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
export const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
export const DEV_API_KEY = process.env.EXPO_PUBLIC_MOBILE_API_KEY ?? ''

// Pure helper — testable without module resets.
export function buildQueryEnabled(opts: {
  devBypass: boolean
  isSignedIn: boolean
}): boolean {
  return opts.devBypass || opts.isSignedIn
}

// Pure helper — testable without module resets.
// Dev bypass uses x-api-key (API key auth); real Clerk sessions use Authorization: Bearer.
export async function buildApiHeaders(opts: {
  devBypass: boolean
  devApiKey: string
  getToken?: (() => Promise<string | null>) | null
}): Promise<HeadersInit> {
  if (opts.devBypass) return { 'x-api-key': opts.devApiKey }
  const token = await opts.getToken?.()
  return { Authorization: `Bearer ${token ?? ''}` }
}

// Convenience wrappers using the module-level constants (used by hooks).
export function queryEnabled(isSignedIn: boolean): boolean {
  return buildQueryEnabled({ devBypass: DEV_BYPASS, isSignedIn })
}

export async function apiHeaders(
  getToken: (() => Promise<string | null>) | null | undefined,
): Promise<HeadersInit> {
  return buildApiHeaders({ devBypass: DEV_BYPASS, devApiKey: DEV_API_KEY, getToken })
}
