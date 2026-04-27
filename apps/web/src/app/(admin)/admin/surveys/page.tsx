'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface Survey {
  id: string
  name: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED'
  _count?: { responses: number }
  incentivePoints: number | null
  triggerCategory: string | null
  triggerKey: string | null
  createdAt: string
}

async function getSurveys(token: string | null): Promise<Survey[]> {
  try {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/surveys`, { cache: 'no-store', headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.data ?? data.surveys ?? (Array.isArray(data) ? data : [])
  } catch {
    return []
  }
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

function CopyWidgetButton({ surveyId }: { surveyId: string }) {
  const [copied, setCopied] = useState(false)
  const snippet = `<script src="${API_URL}/v1/public/surveys/${surveyId}/widget.js"></script>`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(snippet)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      title="Copy widget code"
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Widget'}
    </button>
  )
}

export default function SurveysPage() {
  const { getToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])

  useEffect(() => {
    getToken().then((token) => getSurveys(token).then(setSurveys))
  }, [getToken])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
          <p className="mt-1 text-sm text-gray-500">Manage NPS, CSAT, CES and custom surveys</p>
        </div>
        <Link
          href="/admin/surveys/new"
          data-testid="create-survey-btn"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Survey
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table data-testid="surveys-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Responses</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Incentive Points</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {surveys.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                  No surveys yet.{' '}
                  <Link href="/admin/surveys/new" className="text-indigo-600 hover:underline">
                    Create your first survey
                  </Link>
                </td>
              </tr>
            ) : (
              surveys.map((survey) => (
                <tr key={survey.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link href={`/admin/surveys/${survey.id}`} className="hover:text-indigo-600">
                      {survey.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[survey.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {survey.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {survey.triggerKey ? (
                      <span
                        data-testid={`trigger-badge-${survey.id}`}
                        className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                      >
                        {survey.triggerKey.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[survey.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {survey.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{survey._count?.responses ?? 0}</td>
                  <td className="px-6 py-4 text-gray-700">{survey.incentivePoints ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(survey.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {survey.status === 'ACTIVE' && <CopyWidgetButton surveyId={survey.id} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
