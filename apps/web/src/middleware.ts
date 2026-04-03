import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/request-demo',
  '/api/public(.*)',
  '/survey(.*)',
  '/(.*)/enroll',
  '/spin(.*)',
  '/scratch(.*)',
  '/mystery(.*)',
])

// During Playwright E2E tests there are no real Clerk keys. Pass placeholders
// so clerkMiddleware initialises without throwing; the PLAYWRIGHT_TEST guard
// inside the handler returns NextResponse.next() before any auth runs.
const isE2E = process.env.PLAYWRIGHT_TEST === 'true'
// During E2E tests, use a structurally valid but non-functional Clerk key.
// Format: pk_test_<base64url(frontendApi + '$')>
const clerkPublishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  (isE2E ? 'pk_test_Y2xlcmsudGVzdC5leGFtcGxlLmZha2Uk' : undefined)) as `pk_${'test' | 'live'}_${string}`
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? (isE2E ? 'sk_test_placeholder000000000000000000000000000000' : undefined)

export default clerkMiddleware(
  async (auth, request) => {
    // Allow Playwright E2E tests to bypass Clerk auth
    if (isE2E) {
      return NextResponse.next()
    }

    const session = await auth()
    if (isAdminRoute(request)) {
      if (!session.userId) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
      // Org/role authorization is handled by the API via JWT org_id -> brand mapping
    } else if (!isPublicRoute(request)) {
      if (!session.userId) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
      session.protect()
    }
  },
  { publishableKey: clerkPublishableKey, secretKey: clerkSecretKey },
)

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and survey routes (fully public, no Clerk)
    '/((?!_next|survey|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
