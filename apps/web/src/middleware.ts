import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

// In E2E/dev-bypass mode, skip Clerk entirely before it can do its handshake
// redirect. clerkMiddleware intercepts at the network level before our handler
// fires, so the bypass must wrap the export, not live inside the handler.
const isE2E = process.env.PLAYWRIGHT_TEST === 'true'

function bypassMiddleware(_request: NextRequest) {
  return NextResponse.next()
}

const clerkHandler = clerkMiddleware(
  async (auth, request) => {
    const session = await auth()
    if (isAdminRoute(request)) {
      if (!session.userId) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
    } else if (!isPublicRoute(request)) {
      if (!session.userId) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
      session.protect()
    }
  },
  {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as `pk_${'test' | 'live'}_${string}`,
    secretKey: process.env.CLERK_SECRET_KEY,
  },
)

export default isE2E ? bypassMiddleware : clerkHandler

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and survey routes (fully public, no Clerk)
    '/((?!_next|survey|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
