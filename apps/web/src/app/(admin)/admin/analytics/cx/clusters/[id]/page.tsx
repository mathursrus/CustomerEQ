'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { SENTIMENT } from '@customerEQ/shared'

/* ── Types ── */

interface TrendPoint {
  date: string
  volume: number
  isAnomaly?: boolean
}

interface ClusterDetail {
  id: string
  label: string
  description: string | null
  keywords: string[]
  responseCount: number | null
  avgSentiment: number | null
  trend: TrendPoint[]
}

interface ClusterResponse {
  id: string
  memberName: string | null
  memberEmail: string
  surveyName: string
  score: number | null
  sentiment: number | null
  text: string | null
  topics: string[]
  clusterLabel: string | null
  completedAt: string
}

/* ── SVG Trend Chart ── */

function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No trend data available
      </div>
    )
  }

  const chartW = 700
  const chartH = 200
  const padX = 50
  const padY = 30
  const innerW = chartW - padX * 2
  const innerH = chartH - padY * 2

  const maxVol = Math.max(...data.map((d) => d.volume), 1)

  const points = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padY + innerH - (d.volume / maxVol) * innerH,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Show a subset of date labels
  const labelStep = Math.max(1, Math.floor(data.length / 6))

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padY + innerH - frac * innerH
        return (
          <g key={frac}>
            <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padX - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-400">
              {Math.round(frac * maxVol)}
            </text>
          </g>
        )
      })}

      {/* Line */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.isAnomaly ? 5 : 3}
          fill={p.isAnomaly ? '#ef4444' : '#6366f1'}
          stroke={p.isAnomaly ? '#ef4444' : '#fff'}
          strokeWidth={p.isAnomaly ? 2 : 1.5}
        >
          <title>
            {p.date}: {p.volume} responses{p.isAnomaly ? ' (anomaly)' : ''}
          </title>
        </circle>
      ))}

      {/* X-axis date labels */}
      {points.map(
        (p, i) =>
          i % labelStep === 0 && (
            <text
              key={i}
              x={p.x}
              y={chartH - 4}
              textAnchor="middle"
              className="text-[9px] fill-gray-400"
            >
              {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          )
      )}
    </svg>
  )
}

/* ── Helpers ── */

function sentimentBadge(val: number | null | undefined) {
  if (val == null) return <span className="text-gray-400">--</span>
  const label = SENTIMENT.classify(val)
  const color =
    val > SENTIMENT.POSITIVE_THRESHOLD
      ? 'bg-green-100 text-green-700'
      : val < SENTIMENT.NEGATIVE_THRESHOLD
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}>
      {label} ({val.toFixed(2)})
    </span>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

/* ── Page ── */

export default function ClusterDetailPage() {
  const params = useParams()
  const clusterId = params.id as string
  const { getToken } = useAuth()

  const [cluster, setCluster] = useState<ClusterDetail | null>(null)
  const [responses, setResponses] = useState<ClusterResponse[]>([])
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
      const dateParams = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })

      const trendRes = await fetch(
        `${API_URL}/v1/analytics/cx/clusters/${clusterId}/trend?${dateParams}`,
        { headers },
      )

      if (!trendRes.ok) throw new Error('Failed to load cluster details')
      const trendData = await trendRes.json()
      setCluster({
        id: trendData.clusterId,
        label: trendData.label,
        description: trendData.description,
        keywords: trendData.keywords ?? [],
        responseCount: trendData.responseCount,
        avgSentiment: trendData.avgSentiment,
        trend: trendData.trend ?? [],
      })

      // Fetch responses in this cluster
      const respParams = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        clusterId,
        pageSize: '50',
      })
      const respRes = await fetch(
        `${API_URL}/v1/analytics/cx/responses?${respParams}`,
        { headers },
      )
      if (respRes.ok) {
        const respData = await respRes.json()
        setResponses(respData.data ?? [])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster')
    } finally {
      setLoading(false)
    }
  }, [clusterId, getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <Spinner />

  if (error || !cluster) {
    return (
      <div>
        <Link
          href="/admin/analytics/cx"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to CX Insights
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error ?? 'Cluster not found'}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/admin/analytics/cx"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-4"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to CX Insights
      </Link>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{cluster.label}</h1>
        {cluster.description && (
          <p className="mt-1 text-sm text-gray-500">{cluster.description}</p>
        )}
      </div>

      {/* Keywords */}
      {cluster.keywords && cluster.keywords.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cluster.keywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-200"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Responses</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {(cluster.responseCount ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Avg Sentiment</p>
          <p
            className={`mt-2 text-3xl font-bold ${
              (cluster.avgSentiment ?? 0) > SENTIMENT.POSITIVE_THRESHOLD
                ? 'text-green-700'
                : (cluster.avgSentiment ?? 0) < SENTIMENT.NEGATIVE_THRESHOLD
                  ? 'text-red-700'
                  : 'text-yellow-700'
            }`}
          >
            {(cluster.avgSentiment ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Keywords</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{cluster.keywords?.length ?? 0}</p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Daily Volume Trend</h2>
        <TrendChart data={cluster.trend ?? []} />
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Anomaly
          </span>
        </div>
      </div>

      {/* Responses in Cluster */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Responses in Cluster
            {responses.length > 0 && <span className="text-gray-400 font-normal ml-2">({responses.length})</span>}
          </h2>
        </div>
        {responses.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No responses in this cluster.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {responses.map((r) => (
              <div key={r.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{r.memberName || r.memberEmail}</span>
                    <span>{r.surveyName}</span>
                    <span>{new Date(r.completedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.score != null && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                        {r.score}
                      </span>
                    )}
                    {sentimentBadge(r.sentiment)}
                  </div>
                </div>
                {r.text && <p className="text-sm text-gray-700 mb-2">{r.text}</p>}
                {r.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.topics.map((t) => (
                      <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
