// Issue #241 — public respondent route.
//
// Renders the live survey form using the shared SurveyFormRenderer (Slice 4a)
// so the respondent view matches the editor's Look & Feel preview by
// construction. Previously this page carried a 1000-line bespoke renderer
// that diverged from the editor preview in chrome, theme tokens, rating
// labels, consent rendering, and submit button styling.
//
// Issue #378 — host-page glue (fetch + answers/consent/memberId state +
// validation + error wiring) is shared with the tokenized respondent page
// via useSurveyResponseForm. The page itself only owns its identity field
// (member-id, since the public flow has no token) and the POST body /
// duplicate-or-error branching.
//
// Data shape comes from GET /v1/public/surveys/:id — that endpoint now
// returns title, settings (chromeMatrix), consentMode / consentTextOverride,
// brand consent/identity fields, and the full theme record. See
// apps/api/src/routes/public.ts:139.

'use client'

import { useParams } from 'next/navigation'

import { API_URL } from '@/lib/config'
import { RendererErrorLine, SurveyFormRenderer } from '@/components/survey-form/SurveyFormRenderer'
import { useSurveyResponseForm } from '@/components/survey-form/useSurveyResponseForm'
import type { BrandLite } from '@/components/survey-form/types'
import { useState } from 'react'

// Issue #378 — host-page glue (survey fetch, answers/consent/memberId state,
// validation, error wiring) is shared with the tokenized respondent page via
// `useSurveyResponseForm`. The hook owns `PublicSurveyPayload` + the
// DEFAULT_THEME loading-window fallback. Issue #405 made `survey.theme`
// non-null at the API contract, so the fallback is only hit during the
// pre-fetch loading window — the hook returns `survey.theme` once loaded.

function memberIdLabel(kind: BrandLite['memberIdentifierKind']): string {
  switch (kind) {
    case 'phone':
      return 'Your phone'
    case 'external_id':
      return 'Your customer ID'
    case 'email':
    default:
      return 'Your email'
  }
}

function memberIdInputType(kind: BrandLite['memberIdentifierKind']): string {
  switch (kind) {
    case 'phone':
      return 'tel'
    case 'email':
      return 'email'
    default:
      return 'text'
  }
}

export default function SurveyResponsePage() {
  const params = useParams()
  const surveyId = params.id as string

  const form = useSurveyResponseForm({
    surveyId,
    memberIdRequiredMessage: () => {
      const kind = form.brandLite?.memberIdentifierKind ?? 'email'
      return `${memberIdLabel(kind)} is required.`
    },
  })

  const [duplicate, setDuplicate] = useState(false)

  async function handleSubmit() {
    if (!form.resolvedSurvey || !form.brandLite) return
    if (!form.validate()) return

    form.setSubmitting(true)
    form.setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberEmail: form.memberId.trim(),
          answers: form.answers,
          channel: 'link',
          // R10 / R11: when effective consent mode is EXPLICIT, the API
          // requires `consent: true` in the body. We always send the box's
          // current state — server still rejects (400 CONSENT_REQUIRED) if
          // the box is unchecked, which matches the visible UI gate.
          consent: form.consentChecked,
        }),
      })

      const data = await res.json()

      if (data.duplicate) {
        setDuplicate(true)
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to submit response. Please try again.')
      }

      form.setSubmitted(true)

      if (form.survey?.thankYouRedirectUrl) {
        setTimeout(() => {
          window.location.href = form.survey!.thankYouRedirectUrl as string
        }, 2000)
      }
    } catch (err) {
      form.setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      form.setSubmitting(false)
    }
  }

  if (form.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (form.loadError && !form.survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          {form.loadError}
        </div>
      </div>
    )
  }

  if (duplicate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Already responded</h2>
          <p className="mt-2 text-sm text-amber-800">
            You&apos;ve already submitted a response to this survey. Thank you for your feedback!
          </p>
        </div>
      </div>
    )
  }

  if (form.submitted) {
    const thankYouMsg = form.survey?.thankYouMessage ?? 'Your feedback has been submitted.'
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Thank you!</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{thankYouMsg}</p>
          {form.survey?.thankYouRedirectUrl && (
            <p className="mt-4 text-xs text-gray-400">Redirecting you shortly…</p>
          )}
        </div>
      </div>
    )
  }

  if (!form.resolvedSurvey || !form.brandLite) return null

  // The submit button is intentionally NOT blocked on missing fields —
  // clicking with errors triggers inline messages next to the offending
  // field (and a scroll-to-first-error) so the operator sees what's
  // wrong. Only block while a request is in flight.
  const submitBlocked = form.submitting

  // R15: member-id field rendered above the questions inside the renderer's
  // form. Live mode collects the value here; the renderer is agnostic.
  const memberIdError = form.fieldErrors.memberId
  const memberIdField = (
    <div>
      <label
        style={{
          display: 'block',
          padding: '0.625rem 0.75rem',
          background: 'var(--ceq-background-color)',
          border: `1px solid ${memberIdError ? '#dc2626' : 'var(--ceq-secondary-color)'}`,
          borderRadius: 'var(--ceq-border-radius)',
          color: 'var(--ceq-text-color)',
          fontFamily: 'var(--ceq-font-family)',
          fontSize: 'var(--ceq-body-size)',
        }}
      >
        <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
          {memberIdLabel(form.brandLite.memberIdentifierKind)}{' '}
          <span style={{ color: 'var(--ceq-accent-color)' }}>*</span>
        </span>
        <input
          type={memberIdInputType(form.brandLite.memberIdentifierKind)}
          value={form.memberId}
          onChange={(e) => form.handleMemberIdChange(e.target.value)}
          aria-invalid={memberIdError ? 'true' : 'false'}
          placeholder={form.brandLite.memberIdentifierKind === 'email' ? 'you@example.com' : ''}
          style={{
            width: '100%',
            padding: '0.4rem 0.5rem',
            border: '1px solid var(--ceq-secondary-color)',
            borderRadius: 'var(--ceq-border-radius)',
            background: 'var(--ceq-background-color)',
            color: 'var(--ceq-text-color)',
            fontFamily: 'var(--ceq-font-family)',
            fontSize: 'var(--ceq-body-size)',
          }}
        />
      </label>
      {memberIdError ? (
        <RendererErrorLine slug="memberId" message={memberIdError} />
      ) : null}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {form.error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {form.error}
          </div>
        )}
        <SurveyFormRenderer
          survey={form.resolvedSurvey}
          theme={form.theme}
          brand={form.brandLite}
          channel="standalone"
          viewport="desktop"
          mode="live"
          answers={form.answers}
          onAnswerChange={form.handleAnswerChange}
          consentChecked={form.consentChecked}
          onConsentCheckedChange={form.handleConsentChange}
          errors={{ consent: form.fieldErrors.consent, questions: form.fieldErrors.questions }}
          prefixSlot={memberIdField}
          onSubmit={handleSubmit}
          submitLabel={form.submitting ? 'Submitting…' : 'Submit'}
          submitDisabled={submitBlocked}
        />
      </div>
    </div>
  )
}
