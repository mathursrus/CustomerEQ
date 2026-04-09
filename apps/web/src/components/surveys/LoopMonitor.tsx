'use client'

import { useState, useEffect, useRef } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'

interface LoopMonitorData {
  surveyId: string
  generatedAt: string
  status?: string
  placeholder?: boolean
  message?: string
  pipeline?: {
    surveysSent: number
    responsesReceived: number | null
    scoreDistribution: Record<string, number>
    rulesMatched: number | null
    campaignsTriggered: number | null
    loyaltyOutcomes: {
      pointsAwarded: number | null
      rewardsIssued: number | null
      retentionDelta: number | null
    }
  }
  latency?: {
    p50Ms: number | null
    p95Ms: number | null
    sampleSize: number
    slaStatus: 'ok' | 'warning' | 'breach'
  }
  warning?: {
    type: string
    message: string
  } | null
}

interface Props {
  surveyId: string
  surveyStatus: string
  getToken: () => Promise<string | null>
}

type DrawerStage = 'surveysSent' | 'responsesReceived' | 'rulesMatched' | 'campaignsTriggered' | 'loyaltyOutcomes' | null

const SLA_COLORS = {
  ok: 'text-green-600',
  warning: 'text-amber-600',
  breach: 'text-red-600',
}

const SLA_BG = {
  ok: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
  breach: 'bg-red-50 border-red-200',
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function numOrDash(v: number | null | undefined): string {
  return v !== null && v !== undefined ? v.toLocaleString() : '—'
}

export default function LoopMonitor({ surveyId, surveyStatus, getToken }: Props) {
  const [data, setData] = useState<LoopMonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openDrawer, setOpenDrawer] = useState<DrawerStage>(null)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData() {
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/loop-monitor`, { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // silent — keep stale data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    if (surveyStatus === 'ACTIVE') {
      intervalRef.current = setInterval(fetchData, 60_000) // auto-refresh every 60s
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [surveyId, surveyStatus]) // eslint-disable-line

  if (surveyStatus !== 'ACTIVE') {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-8 text-center" data-testid="loop-monitor-placeholder">
        <p className="text-sm text-gray-400">Loop Monitor activates when the survey is live.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!data || data.placeholder) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-8 text-center" data-testid="loop-monitor-placeholder">
        <p className="text-sm text-gray-400">{data?.message ?? 'No data yet.'}</p>
      </div>
    )
  }

  const p = data.pipeline
  const lat = data.latency

  const stages: Array<{ key: DrawerStage; label: string; value: string; detail?: string }> = [
    { key: 'surveysSent', label: 'Surveys Sent', value: numOrDash(p?.surveysSent) },
    { key: 'responsesReceived', label: 'Responses Received', value: numOrDash(p?.responsesReceived) },
    { key: 'rulesMatched', label: 'Rules Matched', value: numOrDash(p?.rulesMatched) },
    { key: 'campaignsTriggered', label: 'Campaigns Triggered', value: numOrDash(p?.campaignsTriggered) },
    { key: 'loyaltyOutcomes', label: 'Loyalty Outcomes', value: numOrDash(p?.loyaltyOutcomes?.pointsAwarded), detail: 'pts awarded' },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white" data-testid="loop-monitor">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">Loop Monitor</h3>
        <span className="text-xs text-gray-400">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* 48h warning */}
      {data.warning && !warningDismissed && (
        <div className="mx-6 mb-4 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" data-testid="loop-monitor-warning">
          <p className="text-xs text-amber-700">{data.warning.message}</p>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="shrink-0 text-xs text-amber-600 underline hover:text-amber-800"
            data-testid="dismiss-warning-btn"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pipeline stages */}
      <div className="px-6 pb-5">
        <div className="flex items-stretch gap-0 overflow-x-auto" data-testid="pipeline-stages">
          {stages.map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <button
                type="button"
                onClick={() => setOpenDrawer(openDrawer === stage.key ? null : stage.key)}
                className="flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-center hover:bg-indigo-50 hover:border-indigo-200 transition-colors min-w-[120px]"
                data-testid={`stage-${stage.key}`}
              >
                <span className="text-xl font-bold text-gray-900">{stage.value}</span>
                <span className="text-xs text-gray-500 mt-1">{stage.label}</span>
                {stage.detail && <span className="text-xs text-gray-400">{stage.detail}</span>}
              </button>
              {i < stages.length - 1 && (
                <span className="text-gray-300 text-lg px-1">›</span>
              )}
            </div>
          ))}
        </div>

        {/* Inline drawer */}
        {openDrawer && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-5 py-4" data-testid="stage-drawer">
            {openDrawer === 'responsesReceived' && p?.scoreDistribution && (
              <div>
                <p className="text-xs font-medium text-indigo-700 mb-2">Score Distribution</p>
                <div className="flex gap-6">
                  {Object.entries(p.scoreDistribution).map(([range, count]) => (
                    <div key={range} className="text-center">
                      <p className="text-lg font-bold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500">{range}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {openDrawer === 'loyaltyOutcomes' && p?.loyaltyOutcomes && (
              <div>
                <p className="text-xs font-medium text-indigo-700 mb-2">Loyalty Outcomes</p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{numOrDash(p.loyaltyOutcomes.pointsAwarded)}</p>
                    <p className="text-xs text-gray-500">Points Awarded</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{numOrDash(p.loyaltyOutcomes.rewardsIssued)}</p>
                    <p className="text-xs text-gray-500">Rewards Issued</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-500">—</p>
                    <p className="text-xs text-gray-400">Retention Delta (coming soon)</p>
                  </div>
                </div>
              </div>
            )}
            {(openDrawer === 'surveysSent' || openDrawer === 'rulesMatched' || openDrawer === 'campaignsTriggered') && (
              <p className="text-xs text-indigo-700">
                <strong>{stages.find((s) => s.key === openDrawer)?.label}</strong>: {stages.find((s) => s.key === openDrawer)?.value}
              </p>
            )}
          </div>
        )}

        {/* Latency strip */}
        {lat && (
          <div className={`mt-4 rounded-lg border px-4 py-3 ${SLA_BG[lat.slaStatus]}`} data-testid="latency-strip">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-gray-500">P50 </span>
                  <span className={`font-semibold ${SLA_COLORS[lat.slaStatus]}`}>
                    {lat.p50Ms !== null ? fmt(lat.p50Ms) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">P95 </span>
                  <span className={`font-semibold ${SLA_COLORS[lat.slaStatus]}`}>
                    {lat.p95Ms !== null ? fmt(lat.p95Ms) : '—'}
                  </span>
                </div>
                <div className="text-gray-400">n={lat.sampleSize}</div>
              </div>
              <span className={`text-xs font-medium capitalize ${SLA_COLORS[lat.slaStatus]}`} data-testid="sla-status">
                {lat.slaStatus === 'ok' ? '✓ Within SLA' : lat.slaStatus === 'warning' ? '⚡ Near SLA limit' : '⚠ SLA breach'}
              </span>
            </div>
            {lat.sampleSize < 10 && (
              <p className="mt-1 text-xs text-gray-400">Insufficient data for percentiles (need 10+ events)</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
