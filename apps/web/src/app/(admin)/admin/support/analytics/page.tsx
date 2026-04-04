'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

/* ─── Types ────────────────────────────────────────────────────────────── */

interface ConversationRow {
  status: string
  intent: string | null
  createdAt: string
  resolvedAt: string | null
  escalatedAt: string | null
}

interface AnalyticsData {
  total: number
  autoResolved: number
  escalated: number
  abandoned: number
  avgResolutionMs: number
  intentCounts: { intent: string; count: number }[]
  dailyCounts: { day: string; count: number }[]
}

/* ─── Computation ──────────────────────────────────────────────────────── */

function computeAnalytics(conversations: ConversationRow[]): AnalyticsData {
  const total = conversations.length
  const resolved = conversations.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED')
  const escalated = conversations.filter((c) => c.status === 'ESCALATED' || c.escalatedAt)
  const abandoned = conversations.filter(
    (c) => c.status === 'CLOSED' && !c.resolvedAt && !c.escalatedAt,
  )
  const autoResolved = resolved.filter((c) => !c.escalatedAt)

  // Average resolution time
  const resolutionTimes = resolved
    .filter((c) => c.resolvedAt)
    .map((c) => new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime())
  const avgResolutionMs =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0

  // Intent counts
  const intentMap = new Map<string, number>()
  for (const c of conversations) {
    const intent = c.intent ?? 'Unknown'
    intentMap.set(intent, (intentMap.get(intent) ?? 0) + 1)
  }
  const intentCounts = [...intentMap.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)

  // Daily counts (last 7 unique days)
  const dayMap = new Map<string, number>()
  for (const c of conversations) {
    const day = new Date(c.createdAt).toLocaleDateString('en-US', { weekday: 'short' })
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
  }
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dailyCounts = weekDays.map((day) => ({ day, count: dayMap.get(day) ?? 0 }))

  return {
    total,
    autoResolved: autoResolved.length,
    escalated: escalated.length,
    abandoned: abandoned.length,
    avgResolutionMs,
    intentCounts,
    dailyCounts,
  }
}

function formatDuration(ms: number): string {
  if (ms === 0) return '—'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function SupportAnalyticsPage() {
  const { getToken } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  const loadAnalytics = useCallback(async () => {
    const token = await getAuthToken(getToken)
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/support/conversations?pageSize=100`, {
        cache: 'no-store',
        headers,
      })
      if (!res.ok) return
      const data = await res.json()
      const conversations: ConversationRow[] = data.data ?? []
      setAnalytics(computeAnalytics(conversations))
    } catch {
      // ignore
    }
  }, [getToken])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  const deflectionRate =
    analytics.total > 0 ? Math.round((analytics.autoResolved / analytics.total) * 100) : 0
  const escalationRate =
    analytics.total > 0 ? Math.round((analytics.escalated / analytics.total) * 100) : 0
  const maxDaily = Math.max(...analytics.dailyCounts.map((d) => d.count), 1)
  const maxIntent = analytics.intentCounts[0]?.count ?? 1

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Support Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chat volume, resolution rates, and intent breakdown
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Total Conversations</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{analytics.total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Deflection Rate</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{deflectionRate}%</div>
          <div className="text-xs text-gray-400 mt-1">Auto-resolved without escalation</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Escalated</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{escalationRate}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Avg Resolution Time</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {formatDuration(analytics.avgResolutionMs)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Messages per Day */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Conversations Per Day</h3>
          <div className="flex items-end gap-1 h-40">
            {analytics.dailyCounts.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t bg-indigo-600 transition-all"
                  style={{ height: `${Math.max((d.count / maxDaily) * 100, 2)}%` }}
                />
                <span className="text-xs text-gray-400 mt-1">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Intents */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Intents</h3>
          <div className="space-y-3">
            {analytics.intentCounts.slice(0, 6).map((item) => {
              const pct =
                analytics.total > 0 ? Math.round((item.count / analytics.total) * 100) : 0
              return (
                <div key={item.intent}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.intent}</span>
                    <span className="text-gray-500">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${(item.count / maxIntent) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {analytics.intentCounts.length === 0 && (
              <p className="text-sm text-gray-400">No intent data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Resolution Breakdown</h3>
          <div className="flex items-center gap-6">
            {/* Simple donut approximation via SVG */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                {analytics.total > 0 && (
                  <>
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="3"
                      strokeDasharray={`${deflectionRate} ${100 - deflectionRate}`}
                      strokeDashoffset="25"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeDasharray={`${escalationRate} ${100 - escalationRate}`}
                      strokeDashoffset={`${25 + deflectionRate}`}
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{analytics.total}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-600" />
                <span className="text-gray-700">Auto-resolved</span>
                <span className="text-gray-500 ml-auto">
                  {analytics.autoResolved} ({deflectionRate}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-gray-700">Escalated</span>
                <span className="text-gray-500 ml-auto">
                  {analytics.escalated} ({escalationRate}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-700">Abandoned</span>
                <span className="text-gray-500 ml-auto">
                  {analytics.abandoned} (
                  {analytics.total > 0
                    ? Math.round((analytics.abandoned / analytics.total) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
