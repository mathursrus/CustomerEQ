// Issue #378 — Distribution batches filter row (spec §3 / R23).
//
// Placed between Loop Monitor and Response on the survey detail page.
// Default option: "All waves and direct responses" — Response shows
// everything. Each batch is listed as `<label> · <sent date in Brand.timezone>
// · <responded / sent>`. A `Direct responses (share link / embed)` option
// appears only when ≥1 such response exists for this survey.
//
// The filter row is hidden entirely when zero batches AND zero direct responses
// exist for this survey.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'

interface BatchSummary {
  id: string
  label: string
  surveyNameInMail: string
  expiresAt: string
  createdAt: string
  audienceMode: 'existing_members' | 'custom_list'
  sentCount: number
  respondedCount: number
  awaitingCount: number
  expiredCount: number
}

interface DistributionBatchesFilterProps {
  surveyId: string
  brandTimezone: string
  brandLocale: string
  hasDirectResponses: boolean
  onChange?: (selection: 'all' | 'direct' | { batchId: string }) => void
  /**
   * Issue #423 — when present, the component runs in controlled mode and the
   * parent owns the selection state (used by the survey-detail page to lift
   * wave state to feed both this selector and the Response section).
   * Accepts the same shape as `onChange` so the parent can mirror onChange
   * payloads directly. Falls back to uncontrolled local state when omitted.
   */
  value?: 'all' | 'direct' | { batchId: string }
}

/** Maps the controlled `value` prop into the `<select>` value string. */
function normalizeValueToSelectKey(v: 'all' | 'direct' | { batchId: string }): string {
  if (v === 'all') return 'all'
  if (v === 'direct') return 'direct'
  return v.batchId
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

export function DistributionBatchesFilter({
  surveyId,
  brandTimezone,
  brandLocale,
  hasDirectResponses,
  onChange,
  value,
}: DistributionBatchesFilterProps) {
  const { getToken } = useAuth()
  const [batches, setBatches] = useState<BatchSummary[] | null>(null)
  const [uncontrolledSelection, setUncontrolledSelection] = useState<string>('all')
  const selection = value === undefined ? uncontrolledSelection : normalizeValueToSelectKey(value)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await getAuthToken(getToken)
      if (!token) return
      try {
        const res = await fetch(
          `${API_URL}/v1/surveys/${surveyId}/distribution-batches?pageSize=50`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) return
        const body = await res.json()
        if (cancelled) return
        setBatches((body.data ?? []) as BatchSummary[])
      } catch {
        // Soft-fail — filter row is best-effort.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [surveyId, getToken])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value
      if (value === undefined) setUncontrolledSelection(next)
      if (!onChange) return
      if (next === 'all') onChange('all')
      else if (next === 'direct') onChange('direct')
      else onChange({ batchId: next })
    },
    [onChange, value],
  )

  if (batches === null) return null
  if (batches.length === 0 && !hasDirectResponses) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-700">Wave:</label>
        <select
          value={selection}
          onChange={handleChange}
          className="rounded border border-gray-300 px-2 py-1 text-sm flex-1 max-w-md"
        >
          <option value="all">All waves and direct responses</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} · {fmtDate(b.createdAt, brandTimezone, brandLocale)} · {b.respondedCount} /{' '}
              {b.sentCount}
            </option>
          ))}
          {hasDirectResponses ? (
            <option value="direct">Direct responses (share link / embed)</option>
          ) : null}
        </select>
        {selection !== 'all' && selection !== 'direct' ? (
          <a
            href={`/admin/surveys/${surveyId}/distribute/batches/${selection}`}
            className="text-xs text-indigo-600 hover:underline"
          >
            Details →
          </a>
        ) : null}
      </div>
    </div>
  )
}
