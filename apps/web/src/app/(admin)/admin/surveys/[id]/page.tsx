'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { SENTIMENT } from '@customerEQ/shared'
const FRONTEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

interface SurveyResponse {
  id: string
  memberId: string
  score: number | null
  sentiment: number | null
  topics: string[]
  channel: string | null
  completedAt: string
  clusterId: string | null
  cluster: { label: string } | null
}

interface Survey {
  id: string
  name: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED'
  _count?: { responses: number }
  incentivePoints: number | null
  responses: SurveyResponse[]
  createdAt: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-red-100 text-red-700',
}

const typeColors: Record<string, string> = {
  NPS: 'bg-indigo-100 text-indigo-700',
  CSAT: 'bg-blue-100 text-blue-700',
  CES: 'bg-purple-100 text-purple-700',
  CUSTOM: 'bg-gray-100 text-gray-700',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 break-all">
          {text}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function SurveyDetailPage() {
  const params = useParams()
  const surveyId = params.id as string
  const { getToken } = useAuth()

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSurvey = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}`, { headers })
      if (!res.ok) throw new Error(`Failed to load survey`)
      const data = await res.json()
      setSurvey(data.survey ?? data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [surveyId, getToken])

  useEffect(() => {
    fetchSurvey()
  }, [fetchSurvey])

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      await fetchSurvey()
    } catch (err) {
      console.error('Failed to update survey status:', err)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <Spinner />
  if (error || !survey) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'Survey not found'}
      </div>
    )
  }

  const responses: SurveyResponse[] = survey.responses ?? []
  const scores = responses.filter((r) => r.score != null).map((r) => r.score as number)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null

  // NPS calculation: % promoters (9-10) minus % detractors (0-6)
  let npsScore: number | null = null
  if (survey.type === 'NPS' && scores.length > 0) {
    const promoters = scores.filter((s) => s >= 9).length
    const detractors = scores.filter((s) => s <= 6).length
    npsScore = Math.round(((promoters - detractors) / scores.length) * 100)
  }

  // Sentiment distribution (sentiment is a float from -1 to 1)
  function sentimentLabel(s: number | null): string {
    if (s === null) return 'unknown'
    return SENTIMENT.classify(s)
  }
  const sentimentCounts: Record<string, number> = {}
  responses.forEach((r) => {
    const s = sentimentLabel(r.sentiment)
    sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1
  })
  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-500',
    neutral: 'bg-yellow-500',
    negative: 'bg-red-500',
    unknown: 'bg-gray-300',
  }

  const widgetSnippet = `<script src="${API_URL}/v1/public/surveys/${surveyId}/widget.js"></script>`
  const shareLink = `${FRONTEND_URL}/survey/${surveyId}`

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{survey.name}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[survey.type] ?? 'bg-gray-100 text-gray-700'}`}>
              {survey.type}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[survey.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {survey.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {survey._count?.responses ?? responses.length} responses
            {survey.incentivePoints != null && ` \u00b7 ${survey.incentivePoints} incentive points`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {survey.status !== 'ACTIVE' && survey.status !== 'CLOSED' && (
            <button
              type="button"
              onClick={() => updateStatus('ACTIVE')}
              disabled={updating}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              Activate
            </button>
          )}
          {survey.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => updateStatus('PAUSED')}
              disabled={updating}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-60 transition-colors"
            >
              Pause
            </button>
          )}
          {survey.status !== 'CLOSED' && (
            <button
              type="button"
              onClick={() => updateStatus('CLOSED')}
              disabled={updating}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Mini Analytics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Responses</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{survey._count?.responses ?? responses.length}</p>
        </div>
        {avgScore != null && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500">Avg Score</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{avgScore.toFixed(1)}</p>
          </div>
        )}
        {npsScore != null && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500">NPS Score</p>
            <p className={`mt-2 text-3xl font-bold ${npsScore >= 0 ? 'text-green-700' : 'text-red-700'}`}>{npsScore}</p>
          </div>
        )}
        {responses.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500 mb-3">Sentiment</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                <div
                  key={sentiment}
                  className={`${sentimentColors[sentiment] ?? 'bg-gray-300'}`}
                  style={{ width: `${(count / responses.length) * 100}%` }}
                  title={`${sentiment}: ${count}`}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                <span key={sentiment} className="capitalize">{sentiment}: {count}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share & Embed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CopyButton text={shareLink} label="Share Link" />
        <CopyButton text={widgetSnippet} label="Embed Widget" />
      </div>

      {/* Response List */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Responses</h2>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="survey-responses-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member ID</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sentiment</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cluster</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {responses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                    No responses yet.
                  </td>
                </tr>
              ) : (
                responses.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">{r.memberId}</td>
                    <td className="px-6 py-4 text-gray-700">{r.score ?? '—'}</td>
                    <td className="px-6 py-4">
                      {r.sentiment !== null ? (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          r.sentiment > SENTIMENT.POSITIVE_THRESHOLD ? 'bg-green-100 text-green-700'
                            : r.sentiment < SENTIMENT.NEGATIVE_THRESHOLD ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {sentimentLabel(r.sentiment)} ({r.sentiment.toFixed(2)})
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {r.topics?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.topics.map((t, i) => (
                            <span key={i} className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t}</span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {r.cluster ? (
                        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                          {r.cluster.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{r.channel ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(r.completedAt).toLocaleDateString()}
                    </td>
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
