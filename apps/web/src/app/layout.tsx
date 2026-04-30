import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CustomerEQ — Loyalty Platform',
  description: 'Turn Customer Feedback Into Loyalty — Automatically',
}

// During Playwright E2E tests, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.
// Use a structurally valid (but non-functional) Clerk key so ClerkProvider
// initialises without throwing. The middleware bypasses all Clerk auth when
// PLAYWRIGHT_TEST=true, so no real auth flows run.
// Key format: pk_test_<base64url(frontendApi + '$')>
const clerkPublishableKey =
  (process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' || process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true')
    ? 'pk_test_Y2xlcmsudGVzdC5leGFtcGxlLmZha2Uk'
    : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <html lang="en" className={inter.variable}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
