'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface OverviewData {
  totalMembers: number
  pointsIssued: number
  pointsRedeemed: number
  roi: number
}

interface CampaignStat {
  id: string
  name: string
  status: string
  triggers: number
  pointsAwarded: number
  budgetUsed: number
  avgResponseTimeMs: number
}

function KPICard({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p data-testid={testId} className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

export default function AnalyticsPage() {
  const { getToken } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {}
      const params = new URLSearchParams({
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`,
      })
      const [ovRes, campRes] = await Promise.all([
        fetch(`${API_URL}/v1/analytics/overview?${params}`, { headers }),
        fetch(`${API_URL}/v1/analytics/campaigns?${params}`, { headers }),
      ])
      if (ovRes.ok) {
        const d = await ovRes.json()
        setOverview(d.overview ?? d)
      }
      if (campRes.ok) {
        const d = await campRes.json()
        setCampaigns(d.campaigns ?? d ?? [])
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Track loyalty program performance and ROI</p>
      </div>

      {/* Date Range Picker */}
      <div
        data-testid="analytics-date-range"
        className="mb-6 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="startDate" className="text-sm font-medium text-gray-700">From</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="endDate" className="text-sm font-medium text-gray-700">To</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={fetchData}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* KPI Cards */}
          <div data-testid="analytics-kpi-cards" className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
            <KPICard
              label="Total Members"
              value={overview?.totalMembers?.toLocaleString() ?? '—'}
              testId="analytics-total-members"
            />
            <KPICard
              label="Points Issued"
              value={overview?.pointsIssued?.toLocaleString() ?? '—'}
              testId="analytics-points-issued"
            />
            <KPICard
              label="Points Redeemed"
              value={overview?.pointsRedeemed?.toLocaleString() ?? '—'}
              testId="analytics-points-redeemed"
            />
            <KPICard
              label="ROI %"
              value={overview?.roi != null ? `${overview.roi.toFixed(1)}%` : '—'}
              testId="analytics-roi"
            />
          </div>

          {/* Campaign Performance Table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Campaign Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table data-testid="analytics-campaigns-table" className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign Name</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Triggers</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Points Awarded</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget Used</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg. Response Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                        No campaign data for this date range.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                        <td className="px-6 py-4 text-gray-700">{c.status}</td>
                        <td className="px-6 py-4 text-gray-700">{c.triggers?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-700">{c.pointsAwarded?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-700">{c.budgetUsed?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-700">
                          {c.avgResponseTimeMs != null ? `${(c.avgResponseTimeMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
