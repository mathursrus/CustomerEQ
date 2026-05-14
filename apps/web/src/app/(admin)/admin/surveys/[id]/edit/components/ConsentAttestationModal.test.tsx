// Issue #241 Slice 4b (#336) — ConsentAttestationModal RTL.
//
// Coverage per spec §2.1.1 / R10:
//   - Fires when consent dropdown is set to a more-permissive override than
//     Brand.consentMode (parent decides when to open — this modal trusts the
//     `open` prop).
//   - Submit gated until both: reason text supplied (≤500 chars) AND
//     attestation checkbox is checked.
//   - Submits to PATCH /v1/surveys/:id/consent-mode with body:
//       { consentMode, consentReason, attestedBy }
//     (attestedBy auto-fills from the current user — passed in as a prop here).
//   - HTTP 422 surfaces inline as a validation error.
//   - Cancel closes the modal without firing onSubmit.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ConsentAttestationModal } from './ConsentAttestationModal'

const SURVEY_ID = 'srv_test_4b_attestation'
const USER_EMAIL = 'manohar@test.com'

function setup(opts: {
  open?: boolean
  submitFn?: (body: object) => Promise<Response>
  onClose?: () => void
} = {}) {
  const submitFn = opts.submitFn ?? vi.fn(async () => new Response(null, { status: 200 }))
  const onClose = opts.onClose ?? vi.fn()
  render(
    <ConsentAttestationModal
      open={opts.open ?? true}
      surveyId={SURVEY_ID}
      attestedBy={USER_EMAIL}
      nextConsentMode="IMPLIED_ON_SUBMIT"
      onSubmit={submitFn}
      onClose={onClose}
    />,
  )
  return { submitFn, onClose }
}

describe('<ConsentAttestationModal>', () => {
  it('does not render when open=false', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog with the spec wording referencing the deviation log', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/attest/i)
    expect(dialog).toHaveTextContent(/deviation/i)
  })

  describe('submit gating', () => {
    it('submit is disabled until both the reason is non-empty AND attestation is checked', () => {
      setup()
      const submitBtn = screen.getByRole('button', { name: /confirm.*attestation|attest.*confirm|confirm/i })
      expect(submitBtn).toBeDisabled()
      // Reason without checkbox → still disabled.
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Compliance review' } })
      expect(submitBtn).toBeDisabled()
      // Check the attestation box → enabled.
      fireEvent.click(screen.getByLabelText(/i attest/i))
      expect(submitBtn).toBeEnabled()
    })

    it('soft-warns when reason text matches a PII shape (e.g. an email)', () => {
      setup()
      fireEvent.change(screen.getByLabelText(/reason/i), {
        target: { value: 'see manohar@example.com' },
      })
      // The soft warning is informational — it does NOT block submit.
      expect(screen.getByTestId('reason-pii-warning')).toBeInTheDocument()
    })

    it('blocks reason longer than 500 chars (hard cap, not a soft warning)', () => {
      setup()
      const longReason = 'a'.repeat(501)
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: longReason } })
      fireEvent.click(screen.getByLabelText(/i attest/i))
      const submitBtn = screen.getByRole('button', { name: /confirm.*attestation|attest.*confirm|confirm/i })
      expect(submitBtn).toBeDisabled()
      expect(screen.getByText(/500.*characters/i)).toBeInTheDocument()
    })
  })

  describe('PATCH /v1/surveys/:id/consent-mode body shape', () => {
    it('sends consentMode + reason + attestation envelope matching UpdateConsentModeSchema', async () => {
      const submitFn = vi.fn(async () => new Response(null, { status: 200 }))
      setup({ submitFn })
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Compliance review' } })
      fireEvent.click(screen.getByLabelText(/i attest/i))
      fireEvent.click(
        screen.getByRole('button', { name: /confirm.*attestation|attest.*confirm|confirm/i }),
      )
      // Allow microtasks.
      await screen.findByRole('dialog')
      const body = submitFn.mock.calls.at(-1)?.[0] as Record<string, unknown>
      // Wire format matches packages/shared/src/zod/survey.schema.ts:164
      // UpdateConsentModeSchema (`.strict()`). Prior shape sent `attestedBy`
      // which the server would have rejected with FIELD_DISALLOWED — see
      // A04-001 in docs/evidence/336-feature-implementation-evidence.md.
      expect(body).toEqual({
        consentMode: 'IMPLIED_ON_SUBMIT',
        consentReason: 'Compliance review',
        attestation: { confirmed: true, reason: 'Compliance review' },
      })
    })

    it('HTTP 422 from the endpoint surfaces inline (modal stays open with the error)', async () => {
      const submitFn = vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Attestation already on record' }), { status: 422 }),
      )
      setup({ submitFn })
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Compliance review' } })
      fireEvent.click(screen.getByLabelText(/i attest/i))
      fireEvent.click(
        screen.getByRole('button', { name: /confirm.*attestation|attest.*confirm|confirm/i }),
      )
      expect(await screen.findByTestId('attestation-error')).toHaveTextContent(/already on record/i)
      // Modal remains open.
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('cancel', () => {
    it('Cancel button closes the modal without firing onSubmit', () => {
      const submitFn = vi.fn()
      const onClose = vi.fn()
      setup({ submitFn, onClose })
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(submitFn).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
