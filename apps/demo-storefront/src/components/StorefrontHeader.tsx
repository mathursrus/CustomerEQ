'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PersonaPicker } from './PersonaPicker'
import { LoyaltyBar } from './LoyaltyBar'
import { getCart, cartCount } from '@/lib/cart'

const BRAND_NAME = process.env.NEXT_PUBLIC_DEMO_BRAND_NAME ?? 'Demo Brand'
const BRAND_LOGO = process.env.NEXT_PUBLIC_DEMO_BRAND_LOGO ?? null

export function StorefrontHeader() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(cartCount(getCart()))
    const handler = () => setCount(cartCount(getCart()))
    window.addEventListener('ceq_cart_updated', handler)
    return () => window.removeEventListener('ceq_cart_updated', handler)
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      {/* Primary row — brand, persona picker, cart */}
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0" style={{ color: 'var(--brand-primary)' }}>
          {BRAND_LOGO ? (
            <Image src={BRAND_LOGO} alt={BRAND_NAME} width={28} height={28} className="rounded" />
          ) : (
            <span>☕</span>
          )}
          <span>{BRAND_NAME}</span>
        </Link>

        {/* Desktop: loyalty bar + nav links */}
        <div className="hidden sm:flex flex-1 items-center justify-end gap-3">
          <LoyaltyBar />
          <Link href="/surveys" className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
            Surveys
          </Link>
          <Link href="/account" className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
            Account
          </Link>
        </div>

        {/* Mobile: push persona + cart to the right */}
        <div className="flex sm:hidden flex-1" />

        <PersonaPicker />

        <Link
          href="/cart"
          className="relative p-2 text-gray-700 hover:text-gray-900 transition-colors shrink-0"
          aria-label={`Cart — ${count} item${count !== 1 ? 's' : ''}`}
          data-testid="cart-link"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {count > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              data-testid="cart-count"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile-only secondary row: compact loyalty + nav links */}
      <div className="sm:hidden flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-100">
        <LoyaltyBar mobile />
        <div className="flex-1" />
        <Link href="/surveys" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
          Surveys
        </Link>
        <span className="text-gray-300 text-xs">|</span>
        <Link href="/account" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
          Account
        </Link>
      </div>
    </header>
  )
}
