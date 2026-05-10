'use client'

import { useEffect, useState } from 'react'

// Issue #292 Slice 4 — IMPLIED attestation modal. Spec §F7 / RFC §4.2.
// Captures admin-typed justification + explicit checkbox confirmation
// before allowing consentMode to flip to IMPLIED_ON_SUBMIT. Confirm
// button stays disabled until both inputs are populated.

interface ImpliedAttestationModalProps {
  open: boolean
  adminEmail: string
  onConfirm: (attestation: { justification: string; confirmed: true }) => void
  onCancel: () => void
}

export function ImpliedAttestationModal({
  open,
  adminEmail,
  onConfirm,
  onCancel,
}: ImpliedAttestationModalProps) {
  const [justification, setJustification] = useState('')
  const [checked, setChecked] = useState(false)

  // Reset internal state every time the modal opens so a previous
  // cancellation doesn't leak its draft into the next attempt.
  useEffect(() => {
    if (open) {
      setJustification('')
      setChecked(false)
    }
  }, [open])

  if (!open) return null

  const canConfirm = justification.trim().length > 0 && checked

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-16"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Implied consent attestation"
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="px-6 pb-3 pt-5">
          <h3 className="m-0 mb-1 text-lg font-semibold text-gray-900">
            Switch to Implied consent
          </h3>
          <p className="m-0 text-sm text-gray-500">Legal review required before switching.</p>
        </div>
        <div className="space-y-3 px-6 pb-4 pt-1.5">
          <div className="rounded border-l-[3px] border-indigo-500 bg-indigo-50 px-3.5 py-2.5 text-sm leading-snug text-indigo-900">
            Switching to Implied means consent is captured implicitly when a member submits a
            survey. Confirm that you have legal sign-off and that your privacy policy discloses
            implied consent on submission.
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-500">
            Attesting as <strong className="text-gray-900">{adminEmail || 'current admin'}</strong>
            . This attestation is recorded in the audit log.
          </div>
          <div>
            <label
              htmlFor="impl-justification"
              className="block text-sm font-medium text-gray-900"
            >
              Justification
            </label>
            <textarea
              id="impl-justification"
              aria-label="Justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Reviewed with our legal counsel; brand serves SMB-only markets…"
            />
            <p className="mt-1 text-xs text-gray-500">
              Briefly note your legal-review context (≤500 chars).
            </p>
          </div>
          <label className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-900">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 shrink-0 accent-indigo-600"
            />
            <span>
              I confirm legal review has signed off on switching this brand to Implied consent.
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ justification: justification.trim(), confirmed: true })}
            className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Confirm switch to Implied
          </button>
        </div>
      </div>
    </div>
  )
}
