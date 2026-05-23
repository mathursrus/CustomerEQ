// Issue #420 — Add from Custom List card (the second of two side-by-side
// cards in the audience builder, R16). Paste + CSV upload, auto-enroll
// checkbox, "Add N to list" CTA that runs the paste through the backend
// preview to surface matched/unmatched/suppressed rows before appending.
//
// Lifted from SelfServeFlow's `CustomListBody` (the previous radio-toggle
// shape) and reshaped to fit the side-by-side grid. Email-format input is
// always accepted (R19) so brands keyed on phone/external_id can still
// paste email lists; unmatched-against-non-email-keyed-brand rows surface
// in the audience-list "Emails not found" group (Scene 2B).

'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'

import { API_URL, getAuthToken } from '@/lib/config'
import type { AudienceRow, PreviewResponse } from './types'

interface AddFromCustomListCardProps {
  surveyId: string
  surveyNameInMail: string
  expiresAtIso: string
  alreadyAddedKeys: Set<string>
  onAddRows: (rows: AudienceRow[]) => void
}

export function AddFromCustomListCard({
  surveyId,
  surveyNameInMail,
  expiresAtIso,
  alreadyAddedKeys,
  onAddRows,
}: AddFromCustomListCardProps) {
  const { getToken } = useAuth()
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [pasteBody, setPasteBody] = useState('')
  const [autoEnroll, setAutoEnroll] = useState(true)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!pasteBody.trim()) return
    setAdding(true)
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            surveyNameInMail,
            expiresAt: expiresAtIso,
            audience: { mode: 'custom_list', identifiers: pasteBody, autoEnroll },
          }),
        },
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        setError(errBody.error ?? `Add failed (${res.status})`)
        return
      }
      const data = (await res.json()) as PreviewResponse
      const rows = data.members
        .filter((m) => {
          const key = m.memberId ?? m.identifier.toLowerCase()
          return !alreadyAddedKeys.has(key)
        })
        .map<AudienceRow>((m) => ({
          memberId: m.memberId,
          identifier: m.identifier,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          lastResponseThisSurvey: m.lastResponseThisSurvey,
          source: 'CUSTOM_LIST',
          willAutoEnroll: m.willAutoEnroll === true,
          suppressionStatus: m.suppressionStatus,
          suppressionSince: m.suppressionSince,
          selected: m.suppressionStatus === 'OK',
        }))
      if (rows.length > 0) {
        onAddRows(rows)
        setPasteBody('')
        setUploadedFilename(null)
      }
      if (data.unmatchedCount > 0 && !autoEnroll) {
        setError(
          `${data.unmatchedCount} identifier${data.unmatchedCount === 1 ? '' : 's'} not found — enable Auto-enroll to add them as new members.`,
        )
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Add from Custom List</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
          Shared
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Paste identifiers or upload a CSV. <strong>Email format is always accepted</strong> —
        looked up by email regardless of brand identifier kind. Newline-, comma-, or
        semicolon-separated. <code className="rounded bg-gray-100 px-1">Name &lt;email&gt;</code>{' '}
        form accepted.
      </p>

      <div className="mb-3 inline-flex overflow-hidden rounded-md border border-gray-300">
        {(['paste', 'upload'] as const).map((m) => {
          const active = inputMode === m
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setInputMode(m)
                setUploadError(null)
              }}
              className={`px-3 py-1 text-xs font-medium ${
                active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {m === 'paste' ? 'Paste' : '⤓ Upload CSV'}
            </button>
          )
        })}
      </div>

      {inputMode === 'paste' ? (
        <textarea
          value={pasteBody}
          onChange={(e) => {
            setPasteBody(e.target.value)
            if (uploadedFilename) setUploadedFilename(null)
          }}
          placeholder={`alice@artistos.com\nBob Patel <bob@artistos.com>\n+15551234567`}
          className="h-32 w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
          aria-label="Paste identifiers"
        />
      ) : (
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setUploadError(null)
                if (file.size > 10 * 1024 * 1024) {
                  setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB; max 10 MB.`)
                  return
                }
                try {
                  const text = await file.text()
                  setPasteBody(text)
                  setUploadedFilename(file.name)
                } catch (err) {
                  setUploadError(`Could not read file: ${(err as Error).message}`)
                }
              }}
            />
            Choose CSV file…
          </label>
          {uploadedFilename && (
            <p className="text-xs text-gray-600">
              Loaded <span className="font-mono">{uploadedFilename}</span> ·{' '}
              {pasteBody.length.toLocaleString()} chars
            </p>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={autoEnroll}
          onChange={(e) => setAutoEnroll(e.target.checked)}
        />
        Auto-enroll members not in this brand
      </label>

      {error && (
        <p className="mt-2 text-xs text-amber-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !pasteBody.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {adding ? 'Resolving…' : 'Add to list'}
        </button>
      </div>
    </div>
  )
}
