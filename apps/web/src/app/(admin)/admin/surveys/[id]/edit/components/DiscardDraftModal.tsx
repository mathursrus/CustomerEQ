// Issue #241 Slice 4b (#336) — DiscardDraftModal (§J item 10).
//
// Confirmation dialog wired to DELETE /v1/surveys/:id (#333 endpoint).
//   - Confirm → deleteSurvey(id) → onDiscarded() (parent redirects).
//   - Cancel → onClose() with no API call.
//   - HTTP failure surfaces inline (modal stays open).

'use client'

import { useState } from 'react'

import { ModalShell } from '@/components/ModalShell'
import { parseErrorResponse } from '@/lib/errors'

export interface DiscardDraftModalProps {
  open: boolean
  surveyId: string
  surveyName: string
  deleteSurvey: (id: string) => Promise<Response>
  onDiscarded: () => void
  onClose: () => void
}

export function DiscardDraftModal({
  open,
  surveyId,
  surveyName,
  deleteSurvey,
  onDiscarded,
  onClose,
}: DiscardDraftModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleDiscard() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await deleteSurvey(surveyId)
      if (!res.ok) {
        setError(await parseErrorResponse(res))
        return
      }
      onDiscarded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discard failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell open ariaLabelledBy="discard-modal-title">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="px-5 py-4">
          <h2 id="discard-modal-title" className="text-lg font-semibold text-gray-900">
            Discard draft?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            This will permanently delete{' '}
            <span className="font-medium text-gray-900">{surveyName}</span>. This action cannot be
            undone.
          </p>
        </header>

        {error && (
          <p
            data-testid="discard-error"
            className="mx-5 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Discarding…' : 'Discard draft'}
          </button>
        </footer>
      </div>
    </ModalShell>
  )
}
