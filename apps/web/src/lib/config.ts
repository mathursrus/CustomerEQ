/**
 * Centralized configuration for the web app.
 *
 * NEXT_PUBLIC_* env vars are inlined at build time by Next.js.
 * In production Docker builds, they must be passed as build args.
 * The fallback to localhost is only for local development.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const shouldBypassAuthToken =
  process.env.PLAYWRIGHT_TEST === 'true' ||
  process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ||
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

/**
 * Wrapper around Clerk's getToken that returns null when the auth
 * provider is unavailable (network timeout, not initialized, etc.)
 * rather than hanging indefinitely.
 *
 * Timeout is 10s by default. Earlier 1s timeout caused spurious 401s on
 * auto-save when Clerk's session refresh raced the request: getToken
 * resolved to null, the request shipped without Authorization, and the
 * API rejected with 401. 10s is long enough to cover token refresh on
 * a slow network but still short enough to avoid hanging the UI.
 */
export async function getAuthToken(
  getToken: () => Promise<string | null>,
  timeoutMs = 10_000,
): Promise<string | null> {
  if (shouldBypassAuthToken) {
    return null
  }

  try {
    return await Promise.race([
      getToken(),
      new Promise<null>((resolve) => setTimeout(resolve, timeoutMs, null)),
    ])
  } catch {
    return null
  }
}
