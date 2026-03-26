import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/request-demo',
  '/api/public(.*)',
  '/survey(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (isAdminRoute(request)) {
    (await auth()).protect({ role: 'org:admin' })
  } else if (!isPublicRoute(request)) {
    (await auth()).protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and survey routes (fully public, no Clerk)
    '/((?!_next|survey|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
