// Spec §4.2 / R40 — Round-6 filter-responsiveness rule: the Wave filter
// affects BOTH Sent and Responses; response-only filters (date range,
// sentiment scope, channel) affect Responses only, with Sent anchored to
// the wave-level count.

'use client'

import type { Wave } from './waveTypes'

interface BatchSummary {
  id: string
  label: string
  createdAt: string
  sentCount: number
  respondedCount: number
}

export interface SurveyResponsesHeaderStripProps {
  surveyId: string
  /** Lifetime Survey.sentCount (denormalized aggregate per R36). */
  surveyLifetimeSentCount: number
  /** Batch list — used to look up the wave-scoped Sent count and to populate
   *  the dropdown options. */
  batches: BatchSummary[]
  hasDirectResponses: boolean
  /** Controlled wave selection (state lives on the survey-detail page). */
  selectedWave: Wave
  onWaveChange: (next: Wave) => void
  /** Response count after both wave + response-only filters are applied. */
  filteredResponseCount: number
  brandTimezone: string
  brandLocale: string
}

function fmtDate(iso: string, tz: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

function waveToSelectKey(w: Wave): string {
  if (w === 'all') return 'all'
  if (w === 'direct') return 'direct'
  return w.batchId
}

export function SurveyResponsesHeaderStrip({
  surveyId,
  surveyLifetimeSentCount,
  batches,
  hasDirectResponses,
  selectedWave,
  onWaveChange,
  filteredResponseCount,
  brandTimezone,
  brandLocale,
}: SurveyResponsesHeaderStripProps) {
  // Resolve the wave-scoped Sent count.
  //  - 'all'         → lifetime aggregate (Survey.sentCount)
  //  - 'direct'      → null (direct responses have no platform-side Sent record)
  //  - { batchId }   → that batch's sentCount from the list summary
  let waveSentCount: number | null
  let sentCaption: string
  if (selectedWave === 'all') {
    waveSentCount = surveyLifetimeSentCount
    sentCaption = 'lifetime · changes with Wave filter'
  } else if (selectedWave === 'direct') {
    waveSentCount = null
    sentCaption = 'n/a for direct responses'
  } else {
    const batch = batches.find((b) => b.id === selectedWave.batchId)
    waveSentCount = batch?.sentCount ?? null
    sentCaption = 'this wave'
  }

  const responseRate =
    waveSentCount !== null && waveSentCount > 0
      ? Math.round((filteredResponseCount / waveSentCount) * 100)
      : null

  const selectedBatchId = typeof selectedWave === 'object' ? selectedWave.batchId : null

  return (
    <div
      data-testid="responses-header-strip"
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5"
    >
      <div className="text-sm" data-testid="responses-header-sent">
        <span className="font-medium text-slate-900">Survey Sent:</span>{' '}
        <span className="font-semibold text-slate-900">
          {waveSentCount !== null ? waveSentCount.toLocaleString() : '—'}
        </span>
        <span className="ml-1.5 text-[11px] text-slate-500">({sentCaption})</span>
      </div>
      <div className="h-4 w-px bg-slate-300" aria-hidden="true" />
      <div className="text-sm" data-testid="responses-header-responses">
        <span className="font-medium text-slate-900">Responses:</span>{' '}
        <span className="font-semibold text-slate-900">
          {filteredResponseCount.toLocaleString()}
          {waveSentCount !== null ? ` of ${waveSentCount.toLocaleString()}` : ''}
        </span>
        <span className="ml-1.5 text-[11px] text-slate-500">
          {responseRate !== null
            ? `(${responseRate}% · response filters apply)`
            : '(response filters apply)'}
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <label
          className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
          htmlFor={`wave-select-${surveyId}`}
        >
          Wave:
        </label>
        <select
          id={`wave-select-${surveyId}`}
          data-testid="responses-wave-select"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          value={waveToSelectKey(selectedWave)}
          onChange={(e) => {
            const next = e.target.value
            if (next === 'all') onWaveChange('all')
            else if (next === 'direct') onWaveChange('direct')
            else onWaveChange({ batchId: next })
          }}
        >
          <option value="all">All waves and direct responses</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} · {fmtDate(b.createdAt, brandTimezone, brandLocale)} ·{' '}
              {b.respondedCount} / {b.sentCount}
            </option>
          ))}
          {hasDirectResponses ? (
            <option value="direct">Direct responses (share link / embed)</option>
          ) : null}
        </select>
        {selectedBatchId ? (
          <a
            href={`/admin/surveys/${surveyId}/distribute/batches/${selectedBatchId}`}
            className="text-xs font-medium text-indigo-600 hover:underline"
            data-testid="responses-wave-details-link"
          >
            Details →
          </a>
        ) : null}
      </div>
    </div>
  )
}
