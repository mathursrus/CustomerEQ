'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'

interface LoopMonitorData {
  surveyId: string
  generatedAt: string
  status?: string
  placeholder?: boolean
  message?: string
  pipeline?: {
    surveysSent: number
    surveysSentByMode?: {
      MANAGED_EMAIL: number
      SELF_SERVE: number
    }
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
  const [openDrawer, setOpenDrawer] = useState<DrawerStage>(null)
  const [warningDismissed, setWarningDismissed] = useState(false)

  const fetchLoopMonitor = useCallback(async (): Promise<LoopMonitorData> => {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/loop-monitor`, { headers })
    if (!res.ok) throw new Error(`loop-monitor ${res.status}`)
    return (await res.json()) as LoopMonitorData
  }, [surveyId, getToken])

  const { data, loading } = usePollingQuery<LoopMonitorData>({
    fetchFn: fetchLoopMonitor,
    intervalMs: 60_000,
    enabled: surveyStatus === 'ACTIVE',
  })

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

  const sentByMode = p?.surveysSentByMode
  // F13 — Survey Sent is the sum of the two send modes when the breakdown is
  // available; falls back to pipeline.surveysSent only when sentByMode is
  // absent (e.g., older API response shape). The previous direct read of
  // p.surveysSent displayed 0 alongside non-zero mode-counts.
  const surveysSentTotal = sentByMode
    ? sentByMode.MANAGED_EMAIL + sentByMode.SELF_SERVE
    : p?.surveysSent
  const stages: Array<{ key: DrawerStage; label: string; value: string; detail?: string; subline?: ReactNode }> = [
    {
      key: 'surveysSent',
      label: 'Survey Sent',
      value: numOrDash(surveysSentTotal),
      // F12 — split-counts render on separate lines so the tile stays narrow
      // and the operator can scan each mode's count independently. The
      // inline pill was dropped after G14 (pill label became "Sent via
      // CustomerEQ" / "Sent via my email tool") because the subline text
      // already says the same thing — repeating it as a pill is redundant.
      subline: sentByMode ? (
        <span
          className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500 leading-tight mt-1"
          data-testid="surveys-sent-by-mode"
        >
          <span>{sentByMode.MANAGED_EMAIL.toLocaleString()} via CustomerEQ</span>
          <span>{sentByMode.SELF_SERVE.toLocaleString()} via my email tool</span>
        </span>
      ) : null,
    },
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
        {/* Mock #scene-6 lines 1071–1073 — anchor note so the operator
            understands Loop Monitor stays lifetime-wide regardless of any
            Wave filter applied to the Responses section. Spec R39 + #378 §3. */}
        <p
          className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-600"
          data-testid="loop-monitor-lifetime-note"
        >
          <strong className="text-gray-700">Note:</strong> Loop Monitor stays{' '}
          <strong className="text-gray-700">lifetime-wide</strong> regardless of Wave filter — the
          per-batch slicing belongs to the Responses section below.
        </p>
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
                {stage.subline}
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
            {openDrawer === 'surveysSent' && (
              <div data-testid="surveys-sent-drawer">
                <p className="text-xs font-medium text-indigo-700 mb-2">Survey Sent by send mode</p>
                {sentByMode ? (
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{sentByMode.MANAGED_EMAIL.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">via CustomerEQ Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{sentByMode.SELF_SERVE.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">via my email tool</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-indigo-700">
                    <strong>Total:</strong> {numOrDash(p?.surveysSent)}
                  </p>
                )}
              </div>
            )}
            {(openDrawer === 'rulesMatched' || openDrawer === 'campaignsTriggered') && (
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
