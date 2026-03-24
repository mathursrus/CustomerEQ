'use client'

import { UserButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function MemberHeader() {
  const { user } = useUser()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    fetch(`${API_URL}/v1/members/${user.id}/balance`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setBalance(d.pointsBalance ?? d.balance ?? 0)
      })
      .catch(() => {})
  }, [user?.id])

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/member" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="text-base font-semibold text-gray-900">CustomerEQ</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/member" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
            Dashboard
          </Link>
          <Link href="/member/rewards" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
            Rewards
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div
          data-testid="member-points-balance"
          className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5"
        >
          <span className="text-xs font-medium text-indigo-600">Points</span>
          <span className="text-sm font-bold text-indigo-700">
            {balance != null ? balance.toLocaleString() : '—'}
          </span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MemberHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
