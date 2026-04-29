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

interface DashboardData {
  pointsBalance: number
  currencyEquivalent: number | null
  currencyName: string
  tier: { id: string; name: string; rank: number; icon: string | null } | null
  tierProgress: { nextTierName: string; minPoints: number; pointsToNext: number; pct: number } | null
  affordableReward: { id: string; name: string; pointsCost: number } | null
  onboarding: { hasFirstPurchase: boolean }
  recentActivity: Activity[]
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
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    async function fetchDashboard() {
      try {
        const token = await getToken()
        const r = await fetch(`${API_URL}/v1/members/me/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) setData(await r.json())
      } catch {
        // ignore — empty states handle missing data
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [getToken, user?.id])

  if (loading) return <Spinner />

  const balance = data?.pointsBalance ?? 0
  const hasFirstPurchase = data?.onboarding?.hasFirstPurchase ?? false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.firstName ? `Welcome, ${user.firstName}` : 'Welcome'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Your loyalty rewards summary</p>
      </div>

      {/* Getting Started Checklist — R1/R2 */}
      {!hasFirstPurchase && (
        <div className="rounded-xl border border-indigo-100 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900">🚀 Getting Started</h2>
            <span className="text-xs text-gray-400">{hasFirstPurchase ? '2 of 2' : '1 of 2'} done</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: hasFirstPurchase ? '100%' : '50%' }}
            />
          </div>

          {/* Step 1 — always complete */}
          <div className="flex items-center gap-3 py-2.5 border-b border-gray-50">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white text-xs">
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Joined the program</p>
              <p className="text-xs text-gray-400">Enrolled via your account — welcome!</p>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
              +50 pts earned
            </span>
          </div>

          {/* Step 2 — first purchase */}
          <div className="flex items-center gap-3 py-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-indigo-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Make your first purchase</p>
              <p className="text-xs text-gray-400">Earn 2× points on your first order</p>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
              +100 pts
            </span>
          </div>
        </div>
      )}

      {/* Redeem Now CTA — R11 */}
      {data?.affordableReward && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <div>
            <p className="text-sm font-semibold">🎁 You can redeem a reward now!</p>
            <p className="text-xs text-indigo-200 mt-0.5">
              You have enough points for{' '}
              <strong className="text-white">{data.affordableReward.name}</strong>
            </p>
          </div>
          <Link
            href="/rewards"
            className="shrink-0 ml-4 rounded-lg bg-white/20 hover:bg-white/30 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            View Rewards →
          </Link>
        </div>
      )}

      {/* Points Balance Card */}
      <div
        data-testid="member-balance-card"
        className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white"
      >
        <p className="text-sm font-medium text-indigo-100">Your Balance</p>
        <p data-testid="points-balance" className="mt-1 text-5xl font-bold">
          {balance.toLocaleString()}
        </p>
        <p className="mt-1 text-indigo-200 text-sm">
          {data?.currencyName ?? 'Points'}
          {data?.currencyEquivalent != null && (
            <span className="ml-2">· ${data.currencyEquivalent.toFixed(2)} equivalent</span>
          )}
        </p>
        {!data?.affordableReward && (
          <Link
            href="/rewards"
            data-testid="browse-rewards-btn"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Browse Rewards →
          </Link>
        )}
      </div>

      {/* Tier Progress — R15 */}
      {(data?.tier || data?.tierProgress) && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {data.tier?.icon && <span className="text-lg">{data.tier.icon}</span>}
              <span className="text-sm font-semibold text-gray-900">
                {data.tier?.name ?? 'Member'}
              </span>
              <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                Current Tier
              </span>
            </div>
          </div>
          {data.tierProgress && (
            <>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all"
                  style={{ width: `${data.tierProgress.pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                <strong className="text-gray-700">
                  {data.tierProgress.pointsToNext.toLocaleString()} more points
                </strong>{' '}
                to {data.tierProgress.nextTierName}
              </p>
            </>
          )}
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          <Link href="/history" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="activity-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data?.recentActivity || data.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <p className="text-gray-400 text-sm">No activity yet.</p>
                    <p className="text-gray-300 text-xs mt-1">Start earning points to see your history here.</p>
                  </td>
                </tr>
              ) : (
                data.recentActivity.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 text-gray-500 text-xs">
                      {new Date(a.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-gray-900">{a.event}</td>
                    <td className="px-6 py-3.5">
                      <span className={`font-semibold text-xs ${a.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {a.points >= 0 ? '+' : ''}{a.points.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 text-xs">{a.balance.toLocaleString()}</td>
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
