'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { HealthScoreBadge } from '@/components/health-score/HealthScoreBadge'

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

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [data, setData] = useState<Customer360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)

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

  useEffect(() => {
    void fetchData()
  }, [fetchData])

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
          &larr; Back to Members
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
          {error ?? 'Failed to load member data'}
        </div>
      </div>
    )
  }

  const { member, recentEvents, surveyResponses, redemptions, campaignEvents, openCases, stats } =
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
        &larr; Back to Members
      </Link>

      {/* Member Header Row */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-start gap-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold shrink-0">
          {initials.toUpperCase()}
        </div>
        {/* Info */}
        <div className="flex-1">
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

function getBarColor(score: number): string {
  if (score <= 20) return 'bg-red-500'
  if (score <= 40) return 'bg-orange-500'
  if (score <= 60) return 'bg-yellow-400'
  if (score <= 80) return 'bg-green-500'
  return 'bg-green-600'
}
