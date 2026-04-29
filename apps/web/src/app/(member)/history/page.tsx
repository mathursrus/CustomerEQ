'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface ActivityItem {
  id: string
  date: string
  event: string
  points: number
  balance: number
}

interface EventsResponse {
  items: ActivityItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_LIMIT = 25

export default function HistoryPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [data, setData] = useState<EventsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(async (p: number) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/v1/members/me/events?page=${p}&limit=${PAGE_LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) setData(await r.json())
    } catch {
      // empty state handles missing data
    } finally {
      setLoading(false)
    }
  }, [getToken, user?.id])

  useEffect(() => {
    fetchPage(page)
  }, [fetchPage, page])

  const handlePage = (next: number) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Points History</h1>
        <p className="mt-1 text-sm text-gray-500">Full record of your points earned and redeemed</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="history-table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="inline-block h-6 w-6 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <p className="text-gray-400 text-sm">No activity yet.</p>
                    <p className="text-gray-300 text-xs mt-1">Start earning points to see your history here.</p>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const isIneligible = item.points === 0
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3.5 text-gray-500 text-xs">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className={`px-6 py-3.5 ${isIneligible ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                        {item.event}
                      </td>
                      <td className="px-6 py-3.5">
                        {isIneligible ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <span className={`font-semibold text-xs ${item.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.points >= 0 ? '+' : ''}{item.points.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 text-xs">{item.balance.toLocaleString()}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-500">
              Showing {((data.page - 1) * data.limit) + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total.toLocaleString()} events
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePage(data.page - 1)}
                disabled={data.page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() => handlePage(data.page + 1)}
                disabled={data.page >= data.totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
