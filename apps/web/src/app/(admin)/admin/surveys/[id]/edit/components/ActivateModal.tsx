// Issue #241 Slice 4b (#336) — ActivateModal (§J item 9).
//
// Pre-activate summary + R23 gates + PATCH /v1/surveys/:id/status:
//   - Summary: question count, theme name, response policy, consent mode.
//   - Gates per R23:
//       1. Survey.questions.length >= 1
//       2. Survey.title present (R7 required field)
//       3. Consent override (if any) attested — consentSuppressedAttestedBy set.
//   - Success path: activateSurvey(id) → onActivated() (parent redirects).
//   - HTTP 4xx/5xx surfaces inline (modal stays open).

'use client'

import { useState } from 'react'

import type { BrandThemeLite } from '@/components/survey-form/types'

import type {
  EditorBrand,
  EditorSurvey,
} from '../__fixtures__/editor-fixtures'

export interface ActivateModalProps {
  open: boolean
  survey: EditorSurvey
  brand: EditorBrand
  theme: BrandThemeLite | null
  activateSurvey: (id: string) => Promise<Response>
  onActivated: () => void
  onClose: () => void
}

interface GateResult {
  ok: boolean
  failures: string[]
}

function evaluateGates(survey: EditorSurvey): GateResult {
  const failures: string[] = []
  if (!survey.questions || survey.questions.length === 0) {
    failures.push('Add at least one question before activating.')
  }
  const title = (survey.title ?? '').trim()
  if (title.length === 0) {
    failures.push('Survey title is required before activating.')
  }
  if (survey.consentTextOverride && !survey.consentSuppressedAttestedBy) {
    failures.push('Consent override is not attested. Attest the override before activating.')
  }
  return { ok: failures.length === 0, failures }
}

function consentModeLabel(brand: EditorBrand, survey: EditorSurvey): string {
  if (survey.consentTextOverride) return 'Custom override'
  return brand.consentMode === 'EXPLICIT' ? 'Explicit consent required' : 'Implied on submit'
}

function responsePolicyLabel(policy: EditorSurvey['responsePolicy']): string {
  switch (policy) {
    case 'ONCE':
      return 'Once per respondent'
    case 'MULTIPLE':
      return 'Multiple responses allowed'
    case 'LATEST_OVERWRITES':
      return 'Latest response overwrites'
  }
}

export function ActivateModal({
  open,
  survey,
  brand,
  theme,
  activateSurvey,
  onActivated,
  onClose,
}: ActivateModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const gates = evaluateGates(survey)
  const questionCount = survey.questions?.length ?? 0
  const disableActivate = !gates.ok || submitting

  async function handleActivate() {
    if (disableActivate) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await activateSurvey(survey.id)
      if (!res.ok) {
        let message = `Activate failed (HTTP ${res.status})`
        try {
          const parsed = (await res.json()) as { message?: string; error?: string }
          message = parsed.message ?? parsed.error ?? message
        } catch {
          // body wasn't JSON
        }
        setError(message)
        return
      }
      onActivated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activate failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="border-b border-gray-200 px-5 py-4">
          <h2 id="activate-modal-title" className="text-lg font-semibold text-gray-900">
            Activate survey
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Confirm the configuration below before going live.
          </p>
        </header>

        <dl
          data-testid="activate-summary"
          className="space-y-2 border-b border-gray-200 px-5 py-4 text-sm"
        >
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Questions</dt>
            <dd className="font-medium text-gray-900">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Theme</dt>
            <dd className="font-medium text-gray-900">{theme?.name ?? '— no theme —'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Response policy</dt>
            <dd className="font-medium text-gray-900">{responsePolicyLabel(survey.responsePolicy)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Consent</dt>
            <dd className="font-medium text-gray-900">{consentModeLabel(brand, survey)}</dd>
          </div>
        </dl>

        {gates.failures.length > 0 && (
          <ul
            data-testid="activate-gate-failures"
            className="space-y-1 border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800"
          >
            {gates.failures.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}

        {error && (
          <p
            data-testid="activate-error"
            className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <footer className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={disableActivate}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Activating…' : 'Activate & go to detail'}
          </button>
        </footer>
      </div>
    </div>
  )
}
