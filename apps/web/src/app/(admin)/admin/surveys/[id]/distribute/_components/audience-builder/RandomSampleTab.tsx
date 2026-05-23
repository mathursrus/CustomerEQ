// Issue #420 — Existing Members > Random Sample tab.
// Sample-by-percent OR sample-by-count + explicit "Add N members" CTA per R18.
// Hits POST /preview with audience.mode='existing_members' — backend's
// resolveExistingMembers Fisher-Yates picks K eligible (non-erased) members
// and returns them with suppression annotations. The operator clicks Add and
// the exact same K-row pick rides through to the audience list.

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

import { API_URL, getAuthToken } from '@/lib/config'
import type { AudienceRow, PreviewResponse } from './types'

interface RandomSampleTabProps {
  surveyId: string
  surveyNameInMail: string
  expiresAtIso: string
  totalMemberCount: number
  onAddRows: (rows: AudienceRow[]) => void
}

export function RandomSampleTab({
  surveyId,
  surveyNameInMail,
  expiresAtIso,
  totalMemberCount,
  onAddRows,
}: RandomSampleTabProps) {
  const { getToken } = useAuth()
  const [strategy, setStrategy] = useState<'count' | 'percent'>('count')
  const [value, setValue] = useState<number>(Math.min(50, totalMemberCount))
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const max = strategy === 'percent' ? 100 : Math.max(0, totalMemberCount)

  useEffect(() => {
    if (value <= 0) {
      setPreview(null)
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getAuthToken(getToken)
        if (!token) {
          setError('Not authenticated.')
          return
        }
        const res = await fetch(
          `${API_URL}/v1/surveys/${surveyId}/distribution-batches/preview`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              surveyNameInMail,
              expiresAt: expiresAtIso,
              audience: { mode: 'existing_members', strategy, value },
            }),
          },
        )
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(`Preview failed (${res.status})`)
          return
        }
        const data = (await res.json()) as PreviewResponse
        setPreview(data)
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setError((err as Error).message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [surveyId, value, strategy, surveyNameInMail, expiresAtIso, getToken])

  const handleAdd = () => {
    if (!preview) return
    const rows = preview.members.map<AudienceRow>((m) => ({
      memberId: m.memberId,
      identifier: m.identifier,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      lastResponseThisSurvey: m.lastResponseThisSurvey,
      source: 'EXISTING_RANDOM',
      willAutoEnroll: false,
      suppressionStatus: m.suppressionStatus,
      suppressionSince: m.suppressionSince,
      // Suppressed picks land in the audience list but cannot be selected
      // — operator sees who in the random sample can't be reached (R22).
      selected: m.suppressionStatus === 'OK',
    }))
    if (rows.length === 0) return
    onAddRows(rows)
  }

  const eligibleCount = (preview?.members ?? []).filter(
    (m) => m.suppressionStatus === 'OK',
  ).length
  const suppressedCount = (preview?.members ?? []).length - eligibleCount

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Sampling strategy"
          className="inline-flex overflow-hidden rounded-md border border-gray-300"
        >
          {(['count', 'percent'] as const).map((s) => {
            const active = strategy === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setStrategy(s)
                  setValue(s === 'percent' ? 10 : Math.min(50, totalMemberCount))
                }}
                className={`px-3 py-1 text-xs font-medium ${
                  active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s === 'count' ? 'By count' : 'By percent'}
              </button>
            )
          })}
        </div>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            if (Number.isNaN(n)) {
              setValue(0)
              return
            }
            setValue(Math.min(Math.max(0, n), max))
          }}
          aria-label="Sample size"
          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-gray-500">
          {strategy === 'percent' ? '% of eligible' : 'members'} · max {max.toLocaleString()}
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="text-xs text-gray-500">Sampling…</p>}

      {preview && !loading && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-700">
            Random sample of <strong>{preview.members.length}</strong>{' '}
            {preview.members.length === 1 ? 'member' : 'members'} from your{' '}
            {totalMemberCount.toLocaleString()}-member roster.
            {suppressedCount > 0 && (
              <span className="ml-1 text-amber-700">
                ({suppressedCount} suppressed — will be added but cannot be sent to)
              </span>
            )}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={!preview || preview.members.length === 0}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {preview ? `Add ${eligibleCount} members` : 'Add'}
      </button>
    </div>
  )
}
