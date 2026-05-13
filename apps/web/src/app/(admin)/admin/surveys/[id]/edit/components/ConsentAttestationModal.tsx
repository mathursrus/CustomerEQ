// Issue #241 Slice 4b (#336) — ConsentAttestationModal.
//
// Per Spec §2.1.1 / R10:
//   Fires when the operator commits a more-permissive consent override
//   (e.g. brand=EXPLICIT → override=IMPLIED_ON_SUBMIT). The parent decides
//   when to open — this modal only owns the gate UX once `open=true`.
//
// Submit-gate rules:
//   1. Reason text is required (1–500 chars).
//   2. Attestation checkbox must be checked.
//   3. PII shapes in reason → soft warning only (not a hard block).
//
// On confirm, calls onSubmit({ consentMode, consentReason, attestedBy }) and
// surfaces HTTP 4xx/5xx bodies inline (data-testid="attestation-error") so
// the parent doesn't need to translate the response shape.

'use client'

import { useState } from 'react'

type ConsentMode = 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'

export interface ConsentAttestationModalProps {
  open: boolean
  surveyId: string
  /**
   * Displayed in the dialog body ("Attesting as <email>") for operator UX
   * only. The audit row's actor is stamped server-side from the verified
   * Clerk user id — not from this prop — so the client cannot impersonate.
   */
  attestedBy: string
  nextConsentMode: ConsentMode
  /**
   * Wire shape matches `UpdateConsentModeSchema` in
   * `packages/shared/src/zod/survey.schema.ts` — `.strict()` rejects any
   * extra keys (the prior `attestedBy` shape would 422 in production).
   * The handler at `PATCH /v1/surveys/:id/consent-mode` enforces R10 by
   * requiring `attestation.confirmed === true` for more-permissive overrides.
   */
  onSubmit: (body: {
    consentMode: ConsentMode
    consentReason: string
    attestation: {
      confirmed: true
      reason: string
    }
  }) => Promise<Response>
  onClose: () => void
}

const REASON_MAX = 500
// Loose PII shapes: email-ish + phone-ish + SSN-ish. Soft warning only —
// the audit row is a compliance artifact, not a free-form note.
const PII_PATTERNS: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
]

function reasonHasPii(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text))
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Attestation failed (HTTP ${res.status})`
  } catch {
    return `Attestation failed (HTTP ${res.status})`
  }
}

export function ConsentAttestationModal({
  open,
  attestedBy,
  nextConsentMode,
  onSubmit,
  onClose,
}: ConsentAttestationModalProps) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const reasonValid = reason.trim().length > 0 && reason.length <= REASON_MAX
  const overLimit = reason.length > REASON_MAX
  const piiWarning = !overLimit && reason.length > 0 && reasonHasPii(reason)
  const canSubmit = reasonValid && confirmed && !submitting

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await onSubmit({
        consentMode: nextConsentMode,
        consentReason: reason,
        attestation: { confirmed: true, reason },
      })
      if (!res.ok) {
        setError(await readErrorMessage(res))
        return
      }
      setReason('')
      setConfirmed(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attestation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const modeLabel = nextConsentMode === 'EXPLICIT' ? 'Explicit consent' : 'Implied on submit'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-attestation-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 id="consent-attestation-title" className="text-lg font-semibold text-gray-900">
          Attest to consent-mode deviation
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          You are about to set this survey&apos;s consent mode to{' '}
          <span className="font-medium text-gray-900">{modeLabel}</span>, which deviates
          from your brand default. This deviation will be logged with your identity, a
          timestamp, and the reason below.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="attestation-reason" className="block text-sm font-medium text-gray-900">
              Reason for deviation
            </label>
            <textarea
              id="attestation-reason"
              aria-label="Reason for deviation"
              rows={3}
              maxLength={REASON_MAX + 1}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                overLimit ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-200'
              }`}
              placeholder="e.g. Legal review approved this widget-only survey for inline consent."
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={overLimit ? 'text-red-600' : 'text-gray-500'}>
                {overLimit ? `Reason must be 500 characters or fewer (${reason.length}/${REASON_MAX}).` : `${reason.length}/${REASON_MAX} characters`}
              </span>
              {piiWarning && (
                <span data-testid="reason-pii-warning" className="text-amber-700">
                  Heads up — looks like this reason contains personal data. Consider summarizing.
                </span>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              aria-label="I attest to this deviation"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-indigo-600"
            />
            <span>
              I attest that this deviation is approved as noted above and that I am
              authorized to make it on behalf of my brand.
            </span>
          </label>

          <div className="text-xs text-gray-500">
            Attesting as <span className="font-medium text-gray-700">{attestedBy}</span>.
          </div>
        </div>

        {error && (
          <p
            data-testid="attestation-error"
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Confirming…' : 'Confirm attestation'}
          </button>
        </div>
      </div>
    </div>
  )
}
