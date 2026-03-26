import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/request-demo',
  '/api/public(.*)',
  '/survey(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  const session = await auth()
  if (isAdminRoute(request)) {
    if (!session.userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
    session.protect({ role: 'org:admin' })
  } else if (!isPublicRoute(request)) {
    if (!session.userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
    session.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and survey routes (fully public, no Clerk)
    '/((?!_next|survey|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
