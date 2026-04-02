/**
 * Centralized configuration for the web app.
 *
 * NEXT_PUBLIC_* env vars are inlined at build time by Next.js.
 * In production Docker builds, they must be passed as build args.
 * The fallback to localhost is only for local development.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

/**
 * Wrapper around Clerk's getToken that returns null when the auth
 * provider is unavailable (network timeout, not initialized, etc.)
 * rather than hanging indefinitely.
 */
export async function getAuthToken(
  getToken: () => Promise<string | null>,
  timeoutMs = 1000,
): Promise<string | null> {
  try {
    return await Promise.race([
      getToken(),
      new Promise<null>((resolve) => setTimeout(resolve, timeoutMs, null)),
    ])
  } catch {
    return null
  }
}
