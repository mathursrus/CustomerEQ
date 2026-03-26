/**
 * Centralized configuration for the web app.
 *
 * NEXT_PUBLIC_* env vars are inlined at build time by Next.js.
 * In production Docker builds, they must be passed as build args.
 * The fallback to localhost is only for local development.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
