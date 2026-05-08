import type { Metadata } from 'next'
import './globals.css'
import { StorefrontHeader } from '@/components/StorefrontHeader'

const BRAND_NAME = process.env.NEXT_PUBLIC_DEMO_BRAND_NAME ?? 'Demo Brand'
const PRIMARY_COLOR = process.env.NEXT_PUBLIC_DEMO_BRAND_PRIMARY_COLOR ?? '#00704A'
const SECONDARY_COLOR = process.env.NEXT_PUBLIC_DEMO_BRAND_SECONDARY_COLOR ?? '#CBA258'

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_NAME} — Loyalty Rewards Demo`,
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`:root { --brand-primary: ${PRIMARY_COLOR}; --brand-secondary: ${SECONDARY_COLOR}; }`}</style>
      </head>
      <body>
        <StorefrontHeader />
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="max-w-5xl mx-auto px-4 py-6 mt-8 border-t border-gray-100 text-center text-xs text-gray-400">
          {BRAND_NAME} · Powered by{' '}
          <span className="font-semibold text-gray-500">CustomerEQ</span> · Demo environment
        </footer>
      </body>
    </html>
  )
}
