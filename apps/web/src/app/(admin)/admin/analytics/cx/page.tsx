'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { SENTIMENT } from '@customerEQ/shared'

/* ── Types ── */

interface SurveyStats {
  id: string
  name: string
  type: string
  responsesCount: number
  totalResponses: number
  nps: { score: number | null; responses: number; promoters: number; passives: number; detractors: number }
  csat: { average: number | null; responses: number }
  ces: { average: number | null; responses: number }
  sentiment: { average: number | null; distribution: { positive: number; neutral: number; negative: number }; totalAnalyzed: number }
  topTopics: Array<{ topic: string; count: number }>
  clusters: Array<{ id: string; label: string; count: number; avgSentiment: number | null }>
}

interface ClusterSummary {
  id: string
  label: string
  responseCount: number
  avgSentiment: number
  trending: string
  changePercent: number
}

interface Anomaly {
  id: string
  severity: string
  summary: string
  clusterLabel: string | null
  detectedAt: string
}

interface CXOverview {
  totalResponses: number
  nps: { score: number | null; responses: number; promoters: number; passives: number; detractors: number }
  csat: { average: number | null; responses: number }
  ces: { average: number | null; responses: number }
  sentiment: { average: number | null; distribution: { positive: number; neutral: number; negative: number }; totalAnalyzed: number }
  topTopics: Array<{ topic: string; count: number }>
  surveys: SurveyStats[]
  clusters: ClusterSummary[]
  anomalies: Anomaly[]
}

interface ResponseItem {
  id: string
  surveyName: string
  surveyType: string
  memberName: string | null
  memberEmail: string
  score: number | null
  sentiment: number | null
  text: string | null
  topics: string[]
  summary: string | null
  clusterLabel: string | null
  channel: string
  completedAt: string
}

interface ResponsesPage {
  data: ResponseItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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

function ScoreCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function TopicTag({ topic, count }: { topic: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-200">
      {topic}
      <span className="text-indigo-400">({count})</span>
    </span>
  )
}

function SentimentBar({ distribution }: { distribution: { positive: number; neutral: number; negative: number } }) {
  const total = distribution.positive + distribution.neutral + distribution.negative
  if (total === 0) return null
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden mb-2">
        {distribution.positive > 0 && (
          <div className="bg-green-500" style={{ width: `${(distribution.positive / total) * 100}%` }} />
        )}
        {distribution.neutral > 0 && (
          <div className="bg-yellow-400" style={{ width: `${(distribution.neutral / total) * 100}%` }} />
        )}
        {distribution.negative > 0 && (
          <div className="bg-red-500" style={{ width: `${(distribution.negative / total) * 100}%` }} />
        )}
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> {distribution.positive} positive</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" /> {distribution.neutral} neutral</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {distribution.negative} negative</span>
      </div>
    </div>
  )
}

/* ── Page ── */

export default function CXInsightsPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<CXOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Survey filter
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('')

  // Responses detail
  const [responses, setResponses] = useState<ResponsesPage | null>(null)
  const [responsesLoading, setResponsesLoading] = useState(false)
  const [responsesPage, setResponsesPage] = useState(1)

  const getHeaders = useCallback(async () => {
    const token = await getToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    return headers
  }, [getToken])

  const getDateParams = useCallback(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const params = getDateParams()
      const res = await fetch(`${API_URL}/v1/analytics/cx?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to load CX analytics')
      const json = await res.json()
      setData(json)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load CX analytics')
    } finally {
      setLoading(false)
    }
  }, [getHeaders, getDateParams])

  const fetchResponses = useCallback(async (page: number) => {
    setResponsesLoading(true)
    try {
      const headers = await getHeaders()
      const params = getDateParams()
      params.set('page', String(page))
      params.set('pageSize', '15')
      if (selectedSurveyId) params.set('surveyId', selectedSurveyId)
      const res = await fetch(`${API_URL}/v1/analytics/cx/responses?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to load responses')
      const json = await res.json()
      setResponses(json)
    } catch {
      setResponses(null)
    } finally {
      setResponsesLoading(false)
    }
  }, [getHeaders, getDateParams, selectedSurveyId])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setResponsesPage(1); fetchResponses(1) }, [selectedSurveyId, fetchResponses])

  if (loading) return <Spinner />

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'No CX data available'}
      </div>
    )
  }

  // Active stats: either the selected survey or aggregate
  const selectedSurvey = selectedSurveyId
    ? data.surveys.find((s) => s.id === selectedSurveyId)
    : null
  const stats = selectedSurvey ?? data

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CX Insights</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered customer experience analysis across all feedback channels
          </p>
        </div>
        {/* Survey Filter */}
        <select
          value={selectedSurveyId}
          onChange={(e) => setSelectedSurveyId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Surveys</option>
          {data.surveys
            .filter((s) => s.totalResponses > 0)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type} — {s.totalResponses})
              </option>
            ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <ScoreCard label="Total Responses" value={stats.totalResponses.toLocaleString()} />
        <ScoreCard
          label="Avg Sentiment"
          value={stats.sentiment.average != null ? stats.sentiment.average.toFixed(2) : '--'}
          color={stats.sentiment.average != null ? sentimentColor(stats.sentiment.average) : undefined}
        />
        <ScoreCard
          label="NPS Score"
          value={stats.nps.score != null ? String(stats.nps.score) : '--'}
          color={stats.nps.score != null ? (stats.nps.score >= 0 ? 'text-green-700' : 'text-red-700') : undefined}
        />
        <ScoreCard
          label={stats.csat.responses > 0 ? 'CSAT Average' : stats.ces.responses > 0 ? 'CES Average' : 'Analyzed'}
          value={
            stats.csat.responses > 0
              ? (stats.csat.average?.toFixed(2) ?? '--')
              : stats.ces.responses > 0
                ? (stats.ces.average?.toFixed(2) ?? '--')
                : String(stats.sentiment.totalAnalyzed)
          }
        />
      </div>

      {/* Sentiment Distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Sentiment Distribution</h2>
        <SentimentBar distribution={stats.sentiment.distribution} />
      </div>

      {/* Top Topics */}
      {stats.topTopics.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Topics</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topTopics.map((t) => <TopicTag key={t.topic} topic={t.topic} count={t.count} />)}
          </div>
        </div>
      )}

      {/* Anomaly Alerts */}
      {data.anomalies.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-3">Anomaly Alerts</h3>
          <div className="space-y-2">
            {data.anomalies.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColors[a.severity] ?? 'bg-gray-100 text-gray-700'}`}>
                  {a.severity}
                </span>
                <p className="text-sm text-red-700">{a.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Survey Breakdown (only in aggregate view) */}
      {!selectedSurveyId && data.surveys.filter((s) => s.totalResponses > 0).length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Per-Survey Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.surveys
              .filter((s) => s.totalResponses > 0)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSurveyId(s.id)}
                  className="rounded-xl border border-gray-200 bg-white p-5 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">{s.name}</h3>
                    <span className="text-xs font-medium text-gray-400 shrink-0">{s.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                    <span>{s.totalResponses} responses</span>
                    {s.sentiment.average != null && (
                      <span className={sentimentBgColor(s.sentiment.average) + ' rounded-full px-2 py-0.5 text-xs font-medium'}>
                        sentiment {s.sentiment.average.toFixed(2)}
                      </span>
                    )}
                    {s.nps.score != null && <span>NPS {s.nps.score}</span>}
                    {s.csat.average != null && <span>CSAT {s.csat.average.toFixed(1)}</span>}
                    {s.ces.average != null && <span>CES {s.ces.average.toFixed(1)}</span>}
                  </div>
                  {s.topTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.topTopics.slice(0, 4).map((t) => (
                        <span key={t.topic} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {t.topic}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Cluster Grid — scoped to selected survey when filtered */}
      {selectedSurvey ? (
        selectedSurvey.clusters.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Feedback Clusters</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {selectedSurvey.clusters.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/analytics/cx/clusters/${c.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 mb-2">{c.label}</h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-600">{c.count} responses</span>
                    {c.avgSentiment != null && (
                      <span className={`rounded-full px-2 py-0.5 font-medium ${sentimentBgColor(c.avgSentiment)}`}>
                        {c.avgSentiment.toFixed(2)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      ) : (
        data.clusters.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Feedback Clusters</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.clusters.map((cluster) => (
                <Link
                  key={cluster.id}
                  href={`/admin/analytics/cx/clusters/${cluster.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 mb-2">{cluster.label}</h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-600">{cluster.responseCount} responses</span>
                    {cluster.avgSentiment != null && (
                      <span className={`rounded-full px-2 py-0.5 font-medium ${sentimentBgColor(cluster.avgSentiment)}`}>
                        {cluster.avgSentiment.toFixed(2)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      )}

      {/* Response Details */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Response Details
            {responses && <span className="text-gray-400 font-normal ml-2">({responses.total})</span>}
          </h2>
          {selectedSurveyId && (
            <button
              onClick={() => setSelectedSurveyId('')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear filter
            </button>
          )}
        </div>
        {responsesLoading ? (
          <Spinner />
        ) : responses && responses.data.length > 0 ? (
          <>
            <div className="divide-y divide-gray-100">
              {responses.data.map((r) => (
                <div key={r.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
                      <span className="font-medium text-gray-700 truncate">{r.memberName || r.memberEmail}</span>
                      <span className="shrink-0">via {r.channel}</span>
                      <span className="shrink-0">{new Date(r.completedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.score != null && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                          {r.surveyType === 'NPS' ? `NPS ${r.score}` : `${r.score}`}
                        </span>
                      )}
                      {r.sentiment != null && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sentimentBgColor(r.sentiment)}`}>
                          {r.sentiment.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!selectedSurveyId && (
                    <p className="text-[11px] text-gray-400 mb-1">{r.surveyName}</p>
                  )}
                  {r.text && (
                    <p className="text-sm text-gray-700 mb-2">{r.text}</p>
                  )}
                  {r.summary && !r.text && (
                    <p className="text-sm text-gray-500 italic mb-2">{r.summary}</p>
                  )}
                  {(r.topics.length > 0 || r.clusterLabel) && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.clusterLabel && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200">
                          {r.clusterLabel}
                        </span>
                      )}
                      {r.topics.map((t) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Pagination */}
            {responses.totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>Page {responses.page} of {responses.totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={responses.page <= 1}
                    onClick={() => { setResponsesPage(responsesPage - 1); fetchResponses(responsesPage - 1) }}
                    className="rounded px-3 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={responses.page >= responses.totalPages}
                    onClick={() => { setResponsesPage(responsesPage + 1); fetchResponses(responsesPage + 1) }}
                    className="rounded px-3 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No responses found.</div>
        )}
      </div>
    </div>
  )
}
