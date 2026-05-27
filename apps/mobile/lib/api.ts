export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
export const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
export const DEV_TOKEN = 'dev-bypass'

// Pure helper — testable without module resets.
export function buildQueryEnabled(opts: {
  devBypass: boolean
  isSignedIn: boolean
}): boolean {
  return opts.devBypass || opts.isSignedIn
}

// Pure helper — testable without module resets.
export async function buildApiHeaders(opts: {
  devBypass: boolean
  devToken: string
  getToken?: (() => Promise<string | null>) | null
}): Promise<HeadersInit> {
  if (opts.devBypass) return { Authorization: `Bearer ${opts.devToken}` }
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
  return buildApiHeaders({ devBypass: DEV_BYPASS, devToken: DEV_TOKEN, getToken })
}
