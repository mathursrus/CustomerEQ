'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Sticky marketing nav. Starts transparent over the hero and fades in a
 * frosted-glass background + border + shadow once the user scrolls past the
 * fold, so the hero reads clean but the nav stays legible over content below.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-gray-200/70 bg-white/80 backdrop-blur-xl shadow-[0_1px_20px_-8px_rgba(15,23,42,0.25)]'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-105">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            CustomerEQ
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600">
            How it works
          </a>
          <a href="#platform" className="text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600">
            Platform
          </a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600">
            Why CustomerEQ
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/sign-in"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600 sm:px-4"
          >
            Sign In
          </Link>
          <Link
            href="/request-demo"
            className="whitespace-nowrap rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:brightness-110"
          >
            Request Demo
          </Link>
        </div>
      </div>
    </nav>
  )
}
