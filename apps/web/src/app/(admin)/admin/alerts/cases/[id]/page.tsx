'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface CaseNote {
  id: string
  text: string
  author: string
  type: 'NOTE' | 'STATUS_CHANGE'
  createdAt: string
}

interface ChannelNotification {
  channel: 'SLACK' | 'EMAIL' | 'TEAMS'
  sentAt: string
  status: 'SENT' | 'FAILED'
}

interface CaseDetail {
  id: string
  caseNumber: number
  memberId: string
  score: number
  surveyName: string
  sentiment: number | null
  topics: string[]
  feedback: string
  status: 'OPEN' | 'CONTACTED' | 'RESOLVED' | 'CLOSED' | 'OVERDUE'
  assignee: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  slaTarget: string
  alertRuleName: string
  channelsNotified: ChannelNotification[]
  notes: CaseNote[]
  createdAt: string
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  OVERDUE: 'bg-red-100 text-red-700 animate-pulse',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-red-100 text-red-700'
  if (score <= 6) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function slaStatus(slaTarget: string): { label: string; className: string } {
  const target = new Date(slaTarget)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  const diffH = Math.round(diffMs / (1000 * 60 * 60))

  if (diffMs < 0) {
    return { label: `${Math.abs(diffH)}h overdue`, className: 'text-red-600 font-medium' }
  }
  if (diffH <= 4) {
    return { label: `${diffH}h remaining`, className: 'text-yellow-600 font-medium' }
  }
  return { label: 'On track', className: 'text-green-600 font-medium' }
}

const channelLabels: Record<string, string> = {
  SLACK: 'Slack',
  EMAIL: 'Email',
  TEAMS: 'Teams',
}

export default function CaseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { getToken } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadCase = useCallback(async () => {
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/cases/${id}`, { cache: 'no-store', headers })
      if (!res.ok) return
      const data = await res.json()
      setCaseData(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [getToken, id])

  useEffect(() => {
    loadCase()
  }, [loadCase])

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/cases/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await loadCase()
      }
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function addNote() {
    if (!noteText.trim()) return
    setSubmittingNote(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/cases/${id}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: noteText }),
      })
      if (res.ok) {
        setNoteText('')
        setShowNoteInput(false)
        await loadCase()
      }
    } catch {
      // ignore
    } finally {
      setSubmittingNote(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Case not found.</p>
        <Link href="/admin/alerts/cases" className="mt-2 text-sm text-indigo-600 hover:underline">
          Back to cases
        </Link>
      </div>
    )
  }

  const sla = slaStatus(caseData.slaTarget)

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/alerts/cases"
          className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          &larr; Back to Cases
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Case #{caseData.caseNumber}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Respondent Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Respondent Info</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Member ID</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{caseData.memberId}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreColor(caseData.score)}`}>
                  {caseData.score}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Survey</p>
                <p className="mt-1 text-sm text-gray-900">{caseData.surveyName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sentiment</p>
                <p className="mt-1 text-sm text-gray-900">{caseData.sentiment ?? '—'}</p>
              </div>
            </div>
            {caseData.topics.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {caseData.topics.map((topic) => (
                    <span key={topic} className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Feedback</p>
              <div className="border-l-4 border-indigo-300 bg-gray-50 rounded-r-lg px-4 py-3">
                <p className="text-sm text-gray-700 italic">{caseData.feedback}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {caseData.status === 'OPEN' && (
              <button
                onClick={() => updateStatus('CONTACTED')}
                disabled={updatingStatus}
                className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-60 transition-colors"
              >
                Mark Contacted
              </button>
            )}
            {(caseData.status === 'OPEN' || caseData.status === 'CONTACTED') && (
              <button
                onClick={() => updateStatus('RESOLVED')}
                disabled={updatingStatus}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                Mark Resolved
              </button>
            )}
            {caseData.status !== 'CLOSED' && (
              <button
                onClick={() => updateStatus('CLOSED')}
                disabled={updatingStatus}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                Close Case
              </button>
            )}
            <button
              onClick={() => setShowNoteInput(true)}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Add Note
            </button>
          </div>

          {/* Add Note Input */}
          {showNoteInput && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Add Note</h3>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                placeholder="Type your note..."
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={addNote}
                  disabled={submittingNote || !noteText.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {submittingNote ? 'Saving...' : 'Save Note'}
                </button>
                <button
                  onClick={() => { setShowNoteInput(false); setNoteText('') }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            {caseData.notes.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-6">
                  {caseData.notes.map((note) => (
                    <div key={note.id} className="relative flex gap-4">
                      <div
                        className={`relative z-10 flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                          note.type === 'STATUS_CHANGE'
                            ? 'bg-indigo-100 border-indigo-400'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            note.type === 'STATUS_CHANGE' ? 'bg-indigo-500' : 'bg-gray-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-900">{note.author}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p
                          className={`text-sm ${
                            note.type === 'STATUS_CHANGE'
                              ? 'text-indigo-700 font-medium bg-indigo-50 rounded-lg px-3 py-1.5 inline-block'
                              : 'text-gray-700'
                          }`}
                        >
                          {note.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Metadata */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[caseData.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {caseData.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</dt>
                <dd className="mt-1 text-sm text-gray-900">{caseData.assignee ?? 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[caseData.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                    {caseData.priority}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA Target</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(caseData.slaTarget).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA Status</dt>
                <dd className="mt-1">
                  <span className={`text-sm ${sla.className}`}>{sla.label}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert Rule</dt>
                <dd className="mt-1 text-sm text-gray-900">{caseData.alertRuleName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(caseData.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Channels Notified */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Channels Notified</h2>
            {caseData.channelsNotified.length === 0 ? (
              <p className="text-sm text-gray-400">No notifications sent.</p>
            ) : (
              <ul className="space-y-2">
                {caseData.channelsNotified.map((ch, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">{channelLabels[ch.channel] ?? ch.channel}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ch.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {ch.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ch.sentAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
