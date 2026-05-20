// Issue #378 — tokenized respondent page (spec §4).
//
// On mount, calls GET /v1/public/surveys/:id/token-status?token=... to decide
// whether to render the form (state=valid) or one of the 4 error states
// (expired / responded / survey-not-open / invalid). When the form renders,
// the member-id field is suppressed — the token authorizes identity. Submit
// POSTs to /v1/public/surveys/:id/respond with the token in the body; the
// server resolves the member from the token and binds the response to the
// originating DistributionBatch.
//
// No PII appears in any of the 4 error states (NFR-S4). Copy is keyed off
// the server-returned state; the body shape from the server is uniform
// (per NFR-S5) so a timing-attack token-guess can't distinguish states.
//
// Host-page glue (survey fetch, answers/consent state, required-question +
// explicit-consent validation, error wiring) is shared with the public
// BYO-member-id page via useSurveyResponseForm — see that hook for the
// rationale behind the extraction (#378 first introduced this second
// surface; without the shared hook the validation logic would drift, as
// it already did once in this PR).

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

import { API_URL } from '@/lib/config'
import { PoweredByFooter } from '@/components/survey-form/PoweredByFooter'
import { SurveyFormRenderer } from '@/components/survey-form/SurveyFormRenderer'
import { useSurveyResponseForm } from '@/components/survey-form/useSurveyResponseForm'

type TokenState = 'valid' | 'expired' | 'responded' | 'survey-not-open' | 'invalid'

const ERROR_COPY: Record<Exclude<TokenState, 'valid'>, string> = {
  expired:
    'This survey link has expired. If you still want to share feedback, please contact the sender.',
  responded: 'This survey has already been submitted. Thank you for your response!',
  'survey-not-open':
    'This survey is no longer open. If you still want to share feedback, please contact the sender.',
  invalid:
    'This link is not valid. Please check that you copied the full link from your email, or contact the sender.',
}

export default function TokenizedSurveyPage() {
  const params = useParams<{ id: string; token: string }>()
  const surveyId = params.id
  const token = params.token

  const [tokenState, setTokenState] = useState<TokenState | null>(null)
  const [tokenStatusLoading, setTokenStatusLoading] = useState(true)

  // Only fetch the survey once the token-status preflight resolves to 'valid'.
  // The 4 error states don't need (and must not expose) survey content.
  const form = useSurveyResponseForm({
    surveyId,
    identityFromToken: true,
    enabled: tokenState === 'valid',
  })

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      try {
        const res = await fetch(
          `${API_URL}/v1/public/surveys/${surveyId}/token-status?token=${encodeURIComponent(token)}`,
        )
        if (!res.ok) {
          if (!cancelled) setTokenState('invalid')
          return
        }
        const body = (await res.json()) as { state: TokenState }
        if (!cancelled) setTokenState(body.state)
      } catch {
        if (!cancelled) setTokenState('invalid')
      } finally {
        if (!cancelled) setTokenStatusLoading(false)
      }
    }
    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [surveyId, token])

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
          token,
          answers: form.answers,
          channel: 'link',
          consent: form.effectiveConsentMode === 'EXPLICIT' ? form.consentChecked : undefined,
        }),
      })
      if (res.status === 409) {
        // Token already consumed — re-render as 'responded'.
        setTokenState('responded')
        return
      }
      if (res.status === 410) {
        const body = await res.json().catch(() => ({}))
        const state = (body as { state?: TokenState }).state ?? 'invalid'
        setTokenState(state)
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        form.setError(
          (body as { error?: string; message?: string }).message ?? `Submit failed (${res.status})`,
        )
        return
      }
      form.setSubmitted(true)
    } catch (err) {
      form.setError((err as Error).message)
    } finally {
      form.setSubmitting(false)
    }
  }

  if (tokenStatusLoading || (tokenState === 'valid' && form.loading)) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-center">
          <p className="p-8 text-gray-500">Loading…</p>
          {/* Issue #413 — neutral footer on the tokenized loading state. */}
          <PoweredByFooter variant="neutral" channel="link" />
        </div>
      </main>
    )
  }

  if (tokenState && tokenState !== 'valid') {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Issue #413 — R12: the four token-error states (expired / responded /
         * survey-not-open / invalid) share one card chrome and produce
         * byte-identical footer DOM. ERROR_COPY varies the inner <p> only;
         * the surrounding <div> and the footer below are state-independent
         * by construction. The R12 byte-identity assertion in
         * apps/web/src/app/survey/[id]/r/[token]/page.r12-byte-identity.test.tsx
         * locks this invariant. Sister-rule: #378 NFR-S5 timing-attack
         * resistance against token enumeration. */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-center">
          <p className="p-8 text-base text-gray-900">{ERROR_COPY[tokenState]}</p>
          <PoweredByFooter variant="neutral" channel="link" />
        </div>
      </main>
    )
  }

  if (form.submitted) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-center">
          <div className="p-8">
            <p className="text-base text-gray-900">
              {form.survey?.thankYouMessage ?? 'Thank you for your feedback!'}
            </p>
            {form.survey?.thankYouRedirectUrl ? (
              <p className="mt-4">
                <a
                  href={form.survey.thankYouRedirectUrl}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Continue →
                </a>
              </p>
            ) : null}
          </div>
          {/* Issue #413 — neutral footer on the tokenized post-submit state.
           * Future consolidation onto the Scene-2 canonical h2+p treatment
           * (with the standalone survey/[id]/page.tsx post-submit chrome)
           * is tracked in #476. */}
          <PoweredByFooter variant="neutral" channel="link" />
        </div>
      </main>
    )
  }

  if (!form.resolvedSurvey || !form.brandLite) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 text-center">
          <p className="p-8 text-red-600">{form.error ?? form.loadError ?? 'Failed to load survey.'}</p>
          {/* Issue #413 — neutral footer on the tokenized load-failure state. */}
          <PoweredByFooter variant="neutral" channel="link" />
        </div>
      </main>
    )
  }

  // The member-id field is suppressed in token-authorized flow — the token
  // resolves the member; the respondent never sees who they are.
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {form.error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {form.error}
        </div>
      ) : null}
      <SurveyFormRenderer
        survey={form.resolvedSurvey}
        theme={form.theme}
        brand={form.brandLite}
        channel="standalone"
        viewport="desktop"
        mode="live"
        answers={form.answers}
        onAnswerChange={form.handleAnswerChange}
        onSubmit={handleSubmit}
        submitLabel={form.submitting ? 'Submitting…' : 'Submit'}
        submitDisabled={form.submitting}
        consentChecked={form.consentChecked}
        onConsentCheckedChange={form.handleConsentChange}
        errors={{ consent: form.fieldErrors.consent, questions: form.fieldErrors.questions }}
      />
    </main>
  )
}
