'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { HealthScoreBadge } from '@/components/health-score/HealthScoreBadge'
import { SENTIMENT } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Types matching the GET /v1/members/:id/360 response
// ---------------------------------------------------------------------------

interface Tier {
  id: string
  name: string
  rank: number
  benefits: unknown
  multiplier: number
}

type NoteSentiment = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'

interface HealthScoreBreakdown {
  recency: number
  frequency: number
  sentiment: number
  nps: number
  engagement: number
  baseScore: number
  noteModifier: number
  noteSentiment: NoteSentiment | null
  inconsistency: 'auto_healthy_rep_concerned' | 'auto_weak_rep_positive' | null
  overall: number
  computedAt: string
}

interface MemberProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  pointsBalance: number
  status: string
  enrollmentDate: string
  consentGivenAt: string | null
  consentVersion: string | null
  tier: Tier | null
  healthScore: number | null
  healthScoreUpdatedAt: string | null
  healthScoreBreakdown: HealthScoreBreakdown | null
}

interface LoyaltyEvent {
  id: string
  eventType: string
  pointsEarned: number
  payload: unknown
  createdAt: string
}

interface SurveyResponse {
  id: string
  surveyName: string
  surveyType: string
  score: number | null
  sentiment: number | null
  topics: string[]
  summary: string | null
  completedAt: string | null
}

interface Redemption {
  id: string
  rewardName: string
  pointsSpent: number
  status: string
  createdAt: string
}

interface CampaignEvent {
  id: string
  campaignName: string
  triggeredAt: string
  status: string
  result: unknown
}

interface ExternalSignal {
  id: string
  sourceId: string
  sourceType: string
  sourceName: string
  body: string
  summary: string | null
  rating: number | null
  sentiment: number | null
  topics: string[]
  canonicalUrl: string | null
  externalAuthorLabel: string | null
  subjectLabel: string | null
  postedAt: string | null
  matchConfidence: number | null
}

interface OpenCase {
  id: string
  status: string
  priority: string
  assignee: string
  slaDeadline: string | null
  createdAt: string
}

interface Customer360 {
  member: MemberProfile
  recentEvents: { items: LoyaltyEvent[]; hasMore: boolean; total: number }
  surveyResponses: { items: SurveyResponse[]; hasMore: boolean; total: number }
  redemptions: { items: Redemption[]; hasMore: boolean; total: number }
  campaignEvents: { items: CampaignEvent[]; hasMore: boolean; total: number }
  externalSignals: { items: ExternalSignal[]; hasMore: boolean; total: number }
  openCases: OpenCase[]
  stats: {
    totalEvents: number
    totalSurveyResponses: number
    averageSentiment: number | null
    totalPointsEarned: number
    totalPointsRedeemed: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return date.toLocaleDateString()
}

function eventTypeColor(eventType: string): string {
  if (eventType.includes('redeem') || eventType.includes('redemption')) return 'bg-indigo-500'
  if (eventType.includes('survey') || eventType.includes('nps')) return 'bg-blue-500'
  if (eventType.includes('earn') || eventType.includes('purchase')) return 'bg-green-500'
  if (eventType.includes('campaign')) return 'bg-purple-500'
  return 'bg-gray-400'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Note {
  id: string
  body: string
  author: string
  category: string | null
  sentiment: NoteSentiment | null
  createdAt: string
  updatedAt: string
}

const NOTE_CATEGORIES = ['call', 'email', 'meeting', 'note', 'escalation', 'win-back'] as const
const NOTE_SENTIMENTS: { value: NoteSentiment | ''; label: string; chip: string }[] = [
  { value: '', label: 'Not tagged', chip: 'bg-gray-100 text-gray-600' },
  { value: 'very_negative', label: 'Very negative · churn risk', chip: 'bg-red-100 text-red-800' },
  { value: 'negative', label: 'Negative · frustrated', chip: 'bg-orange-100 text-orange-800' },
  { value: 'neutral', label: 'Neutral', chip: 'bg-gray-100 text-gray-700' },
  { value: 'positive', label: 'Positive · happy', chip: 'bg-emerald-100 text-emerald-800' },
  { value: 'very_positive', label: 'Very positive · advocate', chip: 'bg-green-100 text-green-800' },
]

function sentimentChip(s: NoteSentiment | null): string {
  return NOTE_SENTIMENTS.find((x) => x.value === s)?.chip ?? 'bg-gray-100 text-gray-600'
}
function sentimentLabel(s: NoteSentiment | null): string {
  return s ? s.replace('_', ' ') : 'untagged'
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [data, setData] = useState<Customer360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [noteCategory, setNoteCategory] = useState<string>('note')
  const [noteSentiment, setNoteSentiment] = useState<NoteSentiment | ''>('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editCategory, setEditCategory] = useState<string>('note')
  const [editSentiment, setEditSentiment] = useState<NoteSentiment | ''>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/members/${params.id}/360`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        setError(res.status === 404 ? 'Member not found' : 'Failed to load member data')
        return
      }
      const json: Customer360 = await res.json()
      setData(json)
    } catch {
      setError('Network error — could not load member data')
    } finally {
      setLoading(false)
    }
  }, [getToken, params.id])

  const fetchNotes = useCallback(async () => {
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/members/${params.id}/notes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const json = await res.json()
        setNotes(json.data ?? [])
      }
    } catch {
      // silent — notes are non-critical
    }
  }, [getToken, params.id])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim() || noteSubmitting) return
    setNoteSubmitting(true)
    setNoteError(null)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/members/${params.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          body: noteBody.trim(),
          category: noteCategory,
          sentiment: noteSentiment || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setNoteError(err.message || 'Failed to add note')
        return
      }
      setNoteBody('')
      setNoteCategory('note')
      setNoteSentiment('')
      await fetchNotes()
      // Sentiment-tagged notes trigger health score recompute on the server;
      // refetch the 360 after a short delay so the updated score + inconsistency
      // flag show up.
      if (noteSentiment) {
        setTimeout(() => void fetchData(), 2500)
      }
    } catch {
      setNoteError('Network error')
    } finally {
      setNoteSubmitting(false)
    }
  }

  const beginEdit = (note: Note) => {
    setEditingNoteId(note.id)
    setEditBody(note.body)
    setEditCategory(note.category ?? 'note')
    setEditSentiment(note.sentiment ?? '')
  }

  const cancelEdit = () => {
    setEditingNoteId(null)
    setEditBody('')
  }

  const handleSaveEdit = async (noteId: string, originalSentiment: NoteSentiment | null) => {
    if (!editBody.trim()) return
    const newSentiment = editSentiment || null
    const sentimentChanged = originalSentiment !== newSentiment
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/members/${params.id}/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          body: editBody.trim(),
          category: editCategory,
          sentiment: newSentiment,
        }),
      })
      if (!res.ok) return
      setEditingNoteId(null)
      await fetchNotes()
      if (sentimentChanged) setTimeout(() => void fetchData(), 2500)
    } catch {
      // silent
    }
  }

  const handleDelete = async (noteId: string, hadSentiment: boolean) => {
    if (!confirm('Delete this note? This cannot be undone.')) return
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/members/${params.id}/notes/${noteId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      await fetchNotes()
      if (hadSentiment) setTimeout(() => void fetchData(), 2500)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    void fetchData()
    void fetchNotes()
  }, [fetchData, fetchNotes])

  const handleRecompute = async () => {
    setRecomputing(true)
    try {
      const token = await getAuthToken(getToken)
      await fetch(`${API_URL}/v1/admin/health-scores/recompute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ memberId: params.id }),
      })
      // Refetch after a short delay
      setTimeout(() => {
        void fetchData()
        setRecomputing(false)
      }, 3000)
    } catch {
      setRecomputing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-gray-400">Loading member data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/members" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Back to Customers
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {error ?? 'Failed to load member data'}
        </div>
      </div>
    )
  }

  const { member, recentEvents, surveyResponses, redemptions, campaignEvents, externalSignals, openCases, stats } =
    data

  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
      : member.email
  const initials =
    (member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '') ||
    member.email[0]?.toUpperCase() ||
    '?'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link href="/admin/members" className="text-sm text-indigo-600 hover:text-indigo-800">
        &larr; Back to Customers
      </Link>

      {/* Member Header Row */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-start gap-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold shrink-0">
          {initials.toUpperCase()}
        </div>
        {/* Info */}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">Customer 360</p>
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {member.email}
            {member.tier && <> &middot; {member.tier.name} Tier</>}
            {member.enrollmentDate && (
              <>
                {' '}
                &middot; Enrolled{' '}
                {new Date(member.enrollmentDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </>
            )}
          </p>
          <div className="flex gap-6 mt-3 text-sm">
            <div>
              <span className="text-gray-400">Points:</span>{' '}
              <span className="font-medium text-gray-900">
                {member.pointsBalance.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                {member.status}
              </span>
            </div>
            {stats.averageSentiment !== null && (
              <div>
                <span className="text-gray-400">Avg Sentiment:</span>{' '}
                <span className="font-medium text-gray-900">
                  {stats.averageSentiment > 0 ? '+' : ''}
                  {stats.averageSentiment.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Health Score Badge */}
        <HealthScoreBadge
          score={member.healthScore}
          updatedAt={member.healthScoreUpdatedAt}
          size="lg"
        />
      </div>

      {/* Inconsistency banner — rep notes and auto signals disagree */}
      {member.healthScoreBreakdown?.inconsistency && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            member.healthScoreBreakdown.inconsistency === 'auto_healthy_rep_concerned'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-blue-300 bg-blue-50 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="font-medium">
                {member.healthScoreBreakdown.inconsistency === 'auto_healthy_rep_concerned'
                  ? 'Automated signals look healthy, but a rep flagged a concern'
                  : 'Automated signals look weak, but a rep says this customer is happy'}
              </p>
              <p className="text-xs mt-1">
                Base score {member.healthScoreBreakdown.baseScore} from auto signals ·
                {' '}rep-tagged note shifted this by {member.healthScoreBreakdown.noteModifier > 0 ? '+' : ''}
                {member.healthScoreBreakdown.noteModifier}. Worth investigating why they diverge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Health Score Card with Recalculate */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Health Score</h2>
          <button
            type="button"
            onClick={() => void handleRecompute()}
            disabled={recomputing}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
          >
            {recomputing ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>

        {member.healthScore !== null ? (
          <div className="space-y-3">
            {/* Overall display */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Overall Health Score</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{member.healthScore}</span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
            </div>
            {/* Full-width bar */}
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-700 ${getBarColor(member.healthScore)}`}
                style={{ width: `${member.healthScore}%` }}
              />
            </div>
            {/* Sub-score breakdown */}
            {member.healthScoreBreakdown && (
              <div className="pt-2 border-t border-gray-100 mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Composition</span>
                  <span>
                    Auto signals: {member.healthScoreBreakdown.baseScore}
                    {member.healthScoreBreakdown.noteModifier !== 0 && (
                      <span
                        className={`ml-2 font-medium ${
                          member.healthScoreBreakdown.noteModifier > 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {member.healthScoreBreakdown.noteModifier > 0 ? '+' : ''}
                        {member.healthScoreBreakdown.noteModifier} rep note
                        {member.healthScoreBreakdown.noteSentiment && (
                          <span className="text-gray-400 ml-1">
                            ({member.healthScoreBreakdown.noteSentiment.replace('_', ' ')})
                          </span>
                        )}
                      </span>
                    )}
                    {' '}= <span className="font-semibold text-gray-900">{member.healthScoreBreakdown.overall}</span>
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <SubScoreBar label="Recency" value={member.healthScoreBreakdown.recency} weight={0.25} />
                  <SubScoreBar label="Frequency" value={member.healthScoreBreakdown.frequency} weight={0.20} />
                  <SubScoreBar label="Sentiment" value={member.healthScoreBreakdown.sentiment} weight={0.25} />
                  <SubScoreBar label="NPS" value={member.healthScoreBreakdown.nps} weight={0.15} />
                  <SubScoreBar label="Engagement" value={member.healthScoreBreakdown.engagement} weight={0.15} />
                </div>
              </div>
            )}
            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <StatCard label="Total Events" value={stats.totalEvents.toLocaleString()} />
              <StatCard label="Survey Responses" value={stats.totalSurveyResponses.toLocaleString()} />
              <StatCard
                label="Points Earned"
                value={stats.totalPointsEarned.toLocaleString()}
              />
              <StatCard
                label="Points Redeemed"
                value={stats.totalPointsRedeemed.toLocaleString()}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Health score has not been computed yet. Click Recalculate to generate one.
          </p>
        )}
      </div>

      {/* Open Cases (if any) */}
      {openCases.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Open Cases ({openCases.length})
          </h2>
          <div className="space-y-2">
            {openCases.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.priority === 'HIGH' || c.priority === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {c.priority}
                  </span>
                  <span className="text-gray-700">Case #{c.id.slice(0, 8)}</span>
                </div>
                <div className="text-gray-500 text-xs">
                  {c.assignee && <span>Assigned: {c.assignee}</span>}
                  {c.slaDeadline && (
                    <span className="ml-2">SLA: {new Date(c.slaDeadline).toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CRM Notes */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Notes ({notes.length})</h2>
        </div>

        <form onSubmit={handleAddNote} className="space-y-3 mb-4">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note about this customer — call summary, action taken, context, follow-up..."
            rows={3}
            maxLength={4000}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Category:</label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Rep sentiment:</label>
              <select
                value={noteSentiment}
                onChange={(e) => setNoteSentiment(e.target.value as NoteSentiment | '')}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Tagging sentiment influences the customer health score (e.g. very_negative = -40 points)."
              >
                {NOTE_SENTIMENTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-400 ml-auto">{noteBody.length}/4000</span>
            <button
              type="submit"
              disabled={!noteBody.trim() || noteSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {noteSubmitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
          {noteSentiment && (
            <p className="text-xs text-gray-500 italic">
              Tagging sentiment will trigger a health-score recompute for this customer.
            </p>
          )}
          {noteError && <p className="text-xs text-red-600">{noteError}</p>}
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet. Add one above to start tracking interactions.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="border-l-2 border-indigo-200 pl-3 py-1 group">
                {editingNoteId === n.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        {NOTE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={editSentiment}
                        onChange={(e) => setEditSentiment(e.target.value as NoteSentiment | '')}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        {NOTE_SENTIMENTS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(n.id, n.sentiment)}
                          disabled={!editBody.trim()}
                          className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium uppercase tracking-wide">
                        {n.category ?? 'note'}
                      </span>
                      {n.sentiment && (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${sentimentChip(n.sentiment)}`}
                          title="Rep-tagged sentiment — influences health score"
                        >
                          {sentimentLabel(n.sentiment)}
                        </span>
                      )}
                      <span className="font-medium text-gray-700">{n.author}</span>
                      <span>&middot;</span>
                      <span>{formatRelativeTime(n.createdAt)}</span>
                      {n.updatedAt && n.updatedAt !== n.createdAt && (
                        <span className="italic text-gray-400" title={`Edited ${new Date(n.updatedAt).toLocaleString()}`}>
                          &middot; edited
                        </span>
                      )}
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => beginEdit(n)}
                          className="text-gray-500 hover:text-indigo-700 px-1"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(n.id, !!n.sentiment)}
                          className="text-gray-500 hover:text-red-700 px-1"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Recent Activity ({recentEvents.total})
        </h2>
        {recentEvents.items.length === 0 ? (
          <p className="text-sm text-gray-400">No events recorded yet.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {recentEvents.items.map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${eventTypeColor(event.eventType)} mt-1.5 shrink-0`}
                />
                <div>
                  <span className="text-gray-700">
                    {event.eventType}
                    {event.pointsEarned > 0 && (
                      <span className="text-green-600 ml-1">
                        +{event.pointsEarned.toLocaleString()} pts
                      </span>
                    )}
                  </span>
                  <span className="text-gray-400 ml-2">{formatRelativeTime(event.createdAt)}</span>
                </div>
              </div>
            ))}
            {recentEvents.hasMore && (
              <p className="text-xs text-gray-400 pt-1">
                Showing {recentEvents.items.length} of {recentEvents.total} events
              </p>
            )}
          </div>
        )}
      </div>

      {/* Survey Responses */}
      {surveyResponses.total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Survey Responses ({surveyResponses.total})
          </h2>
          <div className="space-y-3 text-sm">
            {surveyResponses.items.map((sr) => (
              <div key={sr.id} className="flex items-start justify-between border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <span className="font-medium text-gray-900">{sr.surveyName}</span>
                  <span className="text-gray-400 text-xs ml-2">{sr.surveyType}</span>
                  {sr.summary && <p className="text-gray-500 text-xs mt-0.5">{sr.summary}</p>}
                </div>
                <div className="text-right shrink-0">
                  {sr.score !== null && (
                    <span className="text-gray-700 font-medium">NPS: {sr.score}</span>
                  )}
                  {sr.sentiment !== null && (
                    <span className="text-gray-500 text-xs ml-2">
                      Sentiment: {sr.sentiment > 0 ? '+' : ''}
                      {sr.sentiment.toFixed(2)}
                    </span>
                  )}
                  {sr.completedAt && (
                    <p className="text-gray-400 text-xs">{formatRelativeTime(sr.completedAt)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redemptions */}
      {redemptions.total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Redemptions ({redemptions.total})
          </h2>
          <div className="space-y-3 text-sm">
            {redemptions.items.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <span className="text-gray-700">{r.rewardName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{r.pointsSpent.toLocaleString()} pts</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'FULFILLED'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-gray-400 text-xs">{formatRelativeTime(r.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Events */}
      {campaignEvents.total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Campaign Events ({campaignEvents.total})
          </h2>
          <div className="space-y-3 text-sm">
            {campaignEvents.items.map((ce) => (
              <div key={ce.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <span className="text-gray-700">{ce.campaignName}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ce.status === 'EXECUTED'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {ce.status}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {formatRelativeTime(ce.triggeredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Signals */}
      {externalSignals.total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            External Signals ({externalSignals.total})
          </h2>
          <div className="space-y-3 text-sm">
            {externalSignals.items.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        {signal.sourceType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-gray-700">{signal.sourceName}</span>
                      {signal.subjectLabel && (
                        <span className="text-xs text-gray-400">{signal.subjectLabel}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-800">{signal.body}</p>
                    {signal.summary && (
                      <p className="mt-1 text-xs text-gray-500">{signal.summary}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {signal.externalAuthorLabel && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {signal.externalAuthorLabel}
                        </span>
                      )}
                      {signal.topics.map((topic) => (
                        <span key={topic} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      {signal.rating != null && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          Rating {signal.rating}
                        </span>
                      )}
                      {signal.sentiment != null && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${signal.sentiment > SENTIMENT.POSITIVE_THRESHOLD ? 'bg-green-50 text-green-700' : signal.sentiment < SENTIMENT.NEGATIVE_THRESHOLD ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {signal.sentiment > 0 ? '+' : ''}
                          {signal.sentiment.toFixed(2)}
                        </span>
                      )}
                      {signal.postedAt && (
                        <span className="text-xs text-gray-400">{formatRelativeTime(signal.postedAt)}</span>
                      )}
                      {signal.canonicalUrl && (
                        <a
                          href={signal.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          Open source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function SubScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="bg-gray-50 rounded-md px-2 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{label}</span>
        <span className="text-xs font-semibold text-gray-900">{value}</span>
      </div>
      <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${getBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">wt {(weight * 100).toFixed(0)}%</p>
    </div>
  )
}

function getBarColor(score: number): string {
  if (score <= 20) return 'bg-red-500'
  if (score <= 40) return 'bg-orange-500'
  if (score <= 60) return 'bg-yellow-400'
  if (score <= 80) return 'bg-green-500'
  return 'bg-green-600'
}
