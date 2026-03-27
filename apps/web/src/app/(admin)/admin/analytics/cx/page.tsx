'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { SENTIMENT } from '@customerEQ/shared'

/* ── Types ── */

interface ClusterSummary {
  id: string
  label: string
  responseCount: number
  avgSentiment: number
  trend: 'up' | 'down' | 'stable'
  changePercent: number
}

interface Anomaly {
  id: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  summary: string
  clusterId: string | null
  detectedAt: string
}

interface CXOverview {
  totalResponses: number
  avgSentiment: number
  npsScore: number | null
  activeAnomalies: number
  clusters: ClusterSummary[]
  anomalies: Anomaly[]
  sentimentDistribution: { positive: number; neutral: number; negative: number }
}

/* ── Helpers ── */

function sentimentColor(val: number): string {
  if (val > SENTIMENT.POSITIVE_THRESHOLD) return 'text-green-700'
  if (val < SENTIMENT.NEGATIVE_THRESHOLD) return 'text-red-700'
  return 'text-yellow-700'
}

function sentimentBgColor(val: number): string {
  if (val > SENTIMENT.POSITIVE_THRESHOLD) return 'bg-green-100 text-green-700'
  if (val < SENTIMENT.NEGATIVE_THRESHOLD) return 'bg-red-100 text-red-700'
  return 'bg-yellow-100 text-yellow-700'
}

function trendArrow(trend: string, changePercent: number) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
        {changePercent.toFixed(1)}%
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
        </svg>
        {changePercent.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 text-sm font-medium">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
      {changePercent.toFixed(1)}%
    </span>
  )
}

const severityColors: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-blue-100 text-blue-700',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

/* ── Page ── */

export default function CXInsightsPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<CXOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {}
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      const res = await fetch(`${API_URL}/v1/analytics/cx?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to load CX analytics')
      const json = await res.json()
      // Map API shape to UI shape
      setData({
        totalResponses: json.totalResponses ?? 0,
        avgSentiment: json.sentiment?.average ?? 0,
        npsScore: json.nps?.score ?? null,
        activeAnomalies: json.anomalies?.length ?? 0,
        clusters: (json.clusters ?? []).map((c: Record<string, unknown>) => ({
          id: c.id,
          label: c.label,
          responseCount: c.responseCount ?? 0,
          avgSentiment: c.avgSentiment ?? 0,
          trend: c.trending ?? 'stable',
          changePercent: c.changePercent ?? 0,
        })),
        anomalies: json.anomalies ?? [],
        sentimentDistribution: json.sentiment?.distribution ?? { positive: 0, neutral: 0, negative: 0 },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load CX analytics')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <Spinner />

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'No CX data available'}
      </div>
    )
  }

  const { sentimentDistribution } = data
  const totalSentiment =
    (sentimentDistribution?.positive ?? 0) +
    (sentimentDistribution?.neutral ?? 0) +
    (sentimentDistribution?.negative ?? 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CX Insights</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered customer experience analysis across all feedback channels
        </p>
      </div>

      {/* Summary Cards */}
      <div data-testid="cx-summary-cards" className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Total Responses</p>
          <p data-testid="cx-total-responses" className="mt-2 text-3xl font-bold text-gray-900">
            {data.totalResponses.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Avg Sentiment</p>
          <p
            data-testid="cx-avg-sentiment"
            className={`mt-2 text-3xl font-bold ${sentimentColor(data.avgSentiment)}`}
          >
            {data.avgSentiment.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">NPS Score</p>
          <p
            data-testid="cx-nps-score"
            className={`mt-2 text-3xl font-bold ${
              data.npsScore != null && data.npsScore >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {data.npsScore != null ? data.npsScore : '--'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Active Anomalies</p>
          <p
            data-testid="cx-active-anomalies"
            className={`mt-2 text-3xl font-bold ${
              data.activeAnomalies > 0 ? 'text-red-700' : 'text-gray-900'
            }`}
          >
            {data.activeAnomalies}
          </p>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {data.anomalies && data.anomalies.length > 0 && (
        <div data-testid="cx-anomaly-alerts" className="mb-8 rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h3 className="text-sm font-semibold text-red-800">Anomaly Alerts</h3>
          </div>
          <div className="space-y-2">
            {data.anomalies.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    severityColors[a.severity] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {a.severity}
                </span>
                <p className="text-sm text-red-700">{a.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cluster Grid */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Feedback Clusters</h2>
        {data.clusters && data.clusters.length > 0 ? (
          <div data-testid="cx-cluster-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.clusters.map((cluster) => (
              <Link
                key={cluster.id}
                href={`/admin/analytics/cx/clusters/${cluster.id}`}
                className="rounded-xl border border-gray-200 bg-white p-6 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {cluster.label}
                  </h3>
                  {trendArrow(cluster.trend, cluster.changePercent)}
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Responses</p>
                    <p className="text-lg font-bold text-gray-900">{cluster.responseCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Sentiment</p>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBgColor(
                        cluster.avgSentiment
                      )}`}
                    >
                      {cluster.avgSentiment.toFixed(2)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            No clusters detected yet. Clusters will appear as responses are analyzed.
          </div>
        )}
      </div>

      {/* Sentiment Distribution */}
      {totalSentiment > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sentiment Distribution</h2>
          <div className="flex h-4 rounded-full overflow-hidden mb-3">
            {sentimentDistribution.positive > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${(sentimentDistribution.positive / totalSentiment) * 100}%` }}
                title={`Positive: ${sentimentDistribution.positive}`}
              />
            )}
            {sentimentDistribution.neutral > 0 && (
              <div
                className="bg-yellow-500"
                style={{ width: `${(sentimentDistribution.neutral / totalSentiment) * 100}%` }}
                title={`Neutral: ${sentimentDistribution.neutral}`}
              />
            )}
            {sentimentDistribution.negative > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${(sentimentDistribution.negative / totalSentiment) * 100}%` }}
                title={`Negative: ${sentimentDistribution.negative}`}
              />
            )}
          </div>
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-gray-600">Positive: {sentimentDistribution.positive}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-gray-600">Neutral: {sentimentDistribution.neutral}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-gray-600">Negative: {sentimentDistribution.negative}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
