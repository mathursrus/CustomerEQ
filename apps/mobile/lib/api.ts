export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
export const DEV_BYPASS = resolveDevBypass(process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH, typeof __DEV__ !== 'undefined' && __DEV__)
export const DEV_API_KEY = process.env.EXPO_PUBLIC_MOBILE_API_KEY ?? ''

// Dev bypass must never survive into OTA/production bundles. In production it
// would replace the Clerk JWT/org context with a tenant-agnostic API key.
export function resolveDevBypass(value: string | undefined, isDev: boolean): boolean {
  return isDev && value?.trim() === 'true'
}

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
