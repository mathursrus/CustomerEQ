// Issue #423 — Submitted date-range filter. Preset chips (7 / 30 / 90 days /
// All time / Custom) plus a custom-date input pair (date-only, no time-of-day
// — server-side end-of-day expansion in brand TZ via `endOfDayInBrandTz`).

'use client'

import { useState } from 'react'

export type SubmittedPreset = '7d' | '30d' | '90d' | 'all' | 'custom'

export interface SubmittedDateRangeValue {
  preset: SubmittedPreset
  from: string | null  // YYYY-MM-DD
  to: string | null    // YYYY-MM-DD
}

export interface SubmittedDateRangeProps {
  value: SubmittedDateRangeValue
  onChange: (next: SubmittedDateRangeValue) => void
  /** Brand timezone, used for the helper text. */
  brandTimezone: string
}

const PRESET_LABELS: Record<SubmittedPreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
  custom: 'Custom…',
}

export function SubmittedDateRange({ value, onChange, brandTimezone }: SubmittedDateRangeProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(value.preset === 'custom')

  function selectPreset(preset: SubmittedPreset) {
    if (preset === 'custom') {
      setShowCustomInputs(true)
      onChange({ preset: 'custom', from: value.from, to: value.to })
      return
    }
    setShowCustomInputs(false)
    onChange({ preset, ...resolvePresetRange(preset) })
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-submitted-date-range">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted:</span>
      {(['7d', '30d', '90d', 'all', 'custom'] as SubmittedPreset[]).map((preset) => {
        const active = value.preset === preset
        return (
          <button
            key={preset}
            type="button"
            aria-pressed={active}
            data-testid={`chip-submitted-${preset}`}
            onClick={() => selectPreset(preset)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              active
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {PRESET_LABELS[preset]}
          </button>
        )
      })}
      {showCustomInputs ? (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={value.from ?? ''}
            data-testid="submitted-from-input"
            aria-label="Submitted from"
            onChange={(e) => onChange({ ...value, preset: 'custom', from: e.target.value || null })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <span className="text-xs text-slate-500">→</span>
          <input
            type="date"
            value={value.to ?? ''}
            data-testid="submitted-to-input"
            aria-label="Submitted to"
            onChange={(e) => onChange({ ...value, preset: 'custom', to: e.target.value || null })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <span className="text-[11px] text-slate-400 ml-1">({brandTimezone})</span>
        </div>
      ) : null}
    </div>
  )
}

/** Resolves a preset to a `(from, to)` pair. Custom returns `(null, null)`
 * so the caller's existing inputs survive. */
export function resolvePresetRange(preset: SubmittedPreset): { from: string | null; to: string | null } {
  if (preset === 'all' || preset === 'custom') return { from: null, to: null }
  const now = new Date()
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  }
}
