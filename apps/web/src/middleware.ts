import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/request-demo',
  '/privacy',
  '/terms',
  '/security',
  '/api/public(.*)',
  '/survey(.*)',
  '/(.*)/enroll',
  '/spin(.*)',
  '/scratch(.*)',
  '/mystery(.*)',
  // MCP OAuth — auth is handled inside route handlers via Bearer token
  '/mcp(.*)',
  '/.well-known(.*)',
  '/api/mcp(.*)',
])

const isE2E = process.env.PLAYWRIGHT_TEST === 'true'

// During E2E tests, bypass clerkMiddleware entirely. clerkMiddleware reads
// request headers synchronously during initialization, which throws under
// Next.js 15's strict async API enforcement when Clerk 5.7.x is paired with
// Next 15 dev mode — turning every request (including Playwright's webServer
// readiness probe at `/`) into a 500. The tests already short-circuit auth
// via the isE2E guard, so skipping clerkMiddleware is functionally equivalent
// for test purposes.
async function e2eMiddleware(_request: NextRequest) {
  return NextResponse.next()
}

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as
  | `pk_${'test' | 'live'}_${string}`
  | undefined
const clerkSecretKey = process.env.CLERK_SECRET_KEY

const realMiddleware = clerkMiddleware(
  async (auth, request) => {
    const session = await auth()
    if (isAdminRoute(request)) {
      if (!session.userId) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
    } else if (!isPublicRoute(request) && !session.userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
  },
  { publishableKey: clerkPublishableKey, secretKey: clerkSecretKey },
)

export default isE2E ? e2eMiddleware : realMiddleware

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and survey routes (fully public, no Clerk)
    '/((?!_next|survey|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
