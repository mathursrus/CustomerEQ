'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface MemberBalance {
  pointsBalance: number
  recentEvents: Array<{
    id: string
    eventType: string
    pointsEarned: number
    createdAt: string
  }>
}

export default function MemberDashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [balance, setBalance] = useState<MemberBalance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBalance() {
      const token = await getToken()
      // In production, memberId would come from a session mapping
      // For MVP, use Clerk userId as the member lookup key
      const res = await fetch(`${API_URL}/v1/members/me/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setBalance(await res.json())
      }
      setLoading(false)
    }
    fetchBalance()
  }, [getToken])

  if (loading) return <div className="text-gray-500">Loading your dashboard...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's your loyalty status.</p>
      </div>

      {/* Points Balance Card */}
      <div
        className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-6 text-white"
        data-testid="member-balance-card"
      >
        <div className="text-sm font-medium opacity-80 mb-1">Your Points Balance</div>
        <div className="text-5xl font-bold" data-testid="points-balance">
          {balance?.pointsBalance?.toLocaleString() ?? 0}
        </div>
        <div className="text-sm opacity-70 mt-1">
          ≈ ${((balance?.pointsBalance ?? 0) * 0.01).toFixed(2)} value
        </div>
      </div>

      {/* Browse Rewards Button */}
      <Link
        href="/member/rewards"
        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        data-testid="browse-rewards-btn"
      >
        Browse Rewards →
      </Link>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
        {!balance?.recentEvents?.length ? (
          <p className="text-gray-500 text-sm">No activity yet. Start earning points!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="activity-table">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 font-medium text-gray-700">Event</th>
                  <th className="text-right py-2 font-medium text-gray-700">Points</th>
                </tr>
              </thead>
              <tbody>
                {balance.recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-gray-900 capitalize">
                      {event.eventType.replace(/_/g, ' ')}
                    </td>
                    <td className={`py-2 text-right font-medium ${event.pointsEarned >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {event.pointsEarned >= 0 ? '+' : ''}{event.pointsEarned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
