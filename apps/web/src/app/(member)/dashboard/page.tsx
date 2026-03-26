'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { API_URL } from '@/lib/config'

interface Activity {
  id: string
  date: string
  event: string
  points: number
  balance: number
}

interface BalanceData {
  pointsBalance: number
  currencyEquivalent?: number
  currencyName?: string
  recentActivity?: Activity[]
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

export default function MemberDashboardPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [data, setData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    async function fetchBalance() {
      try {
        const token = await getToken()
        const r = await fetch(`${API_URL}/v1/members/me/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) {
          const d = await r.json()
          setData(d)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchBalance()
  }, [getToken, user?.id])

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.firstName ? `Welcome back, ${user.firstName}` : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{"Here's your loyalty rewards summary"}</p>
      </div>

      {/* Points Balance Card */}
      <div
        data-testid="member-balance-card"
        className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-white"
      >
        <p className="text-sm font-medium text-indigo-100">Your Balance</p>
        <p data-testid="points-balance" className="mt-2 text-5xl font-bold">
          {data?.pointsBalance?.toLocaleString() ?? '0'}
        </p>
        <p className="mt-1 text-indigo-200">
          {data?.currencyName ?? 'Points'}
          {data?.currencyEquivalent != null && (
            <span className="ml-2">· ${data.currencyEquivalent.toFixed(2)} equivalent</span>
          )}
        </p>
        <Link
          href="/rewards"
          data-testid="browse-rewards-btn"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Browse Rewards
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="activity-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!data?.recentActivity || data.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                    No activity yet. Start earning points!
                  </td>
                </tr>
              ) : (
                data.recentActivity.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">{new Date(a.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-gray-900">{a.event}</td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${a.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {a.points >= 0 ? '+' : ''}{a.points.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{a.balance.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
