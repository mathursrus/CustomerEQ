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

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'

import { API_URL } from '@/lib/config'
import { RendererErrorLine, SurveyFormRenderer } from '@/components/survey-form/SurveyFormRenderer'
import type {
  AnswersState,
  BrandLite,
  BrandThemeLite,
  SurveyResolved,
} from '@/components/survey-form/types'

interface PublicSurveyPayload {
  id: string
  name: string
  title: string | null
  description: string | null
  type: SurveyResolved['type']
  status: SurveyResolved['status']
  programId: string
  themeId: string | null
  questions: SurveyResolved['questions']
  settings: SurveyResolved['settings'] | null
  responsePolicy: SurveyResolved['responsePolicy']
  consentMode: SurveyResolved['consentMode']
  consentTextOverride: string | null
  thankYouMessage: string
  thankYouRedirectUrl: string | null
  brand: {
    id: string
    name: string
    logoUrl: string | null
    consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
    consentTextDefault: string | null
    termsUrl: string | null
    privacyPolicyUrl: string | null
    memberIdentifierKind: 'email' | 'phone' | 'external_id'
  }
  theme: BrandThemeLite | null
}

type TokenState = 'valid' | 'expired' | 'responded' | 'survey-not-open' | 'invalid'

const DEFAULT_THEME: BrandThemeLite = {
  id: 'thm_default',
  name: 'Default',
  primaryColor: '#6366f1',
  secondaryColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#6366f1',
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  maxWidth: 'md',
  borderRadius: 'md',
  cardStyle: 'shadow',
  backgroundImageUrl: null,
}

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
  const [survey, setSurvey] = useState<PublicSurveyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<AnswersState>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Validate the token, then load the survey if valid.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const statusRes = await fetch(
          `${API_URL}/v1/public/surveys/${surveyId}/token-status?token=${encodeURIComponent(token)}`,
        )
        if (!statusRes.ok) {
          if (!cancelled) setTokenState('invalid')
          return
        }
        const statusBody = (await statusRes.json()) as { state: TokenState }
        if (cancelled) return
        setTokenState(statusBody.state)
        if (statusBody.state !== 'valid') return

        const surveyRes = await fetch(`${API_URL}/v1/public/surveys/${surveyId}`)
        if (!surveyRes.ok) {
          if (!cancelled) setError('Failed to load survey.')
          return
        }
        const surveyBody = (await surveyRes.json()) as PublicSurveyPayload
        if (!cancelled) setSurvey(surveyBody)
      } catch {
        if (!cancelled) setTokenState('invalid')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [surveyId, token])

  const resolvedSurvey = useMemo<SurveyResolved | null>(() => {
    if (!survey) return null
    return {
      id: survey.id,
      name: survey.name,
      title: survey.title,
      description: survey.description,
      type: survey.type,
      status: survey.status,
      programId: survey.programId,
      themeId: survey.themeId,
      questions: survey.questions,
      consentMode: survey.consentMode,
      consentTextOverride: survey.consentTextOverride,
      responsePolicy: survey.responsePolicy,
      thankYouMessage: survey.thankYouMessage,
      thankYouRedirectUrl: survey.thankYouRedirectUrl,
      settings: survey.settings ?? {},
    }
  }, [survey])

  const brandLite = useMemo<BrandLite | null>(() => {
    if (!survey) return null
    return {
      id: survey.brand.id,
      name: survey.brand.name,
      logoUrl: survey.brand.logoUrl,
      consentMode: survey.brand.consentMode,
      consentTextDefault: survey.brand.consentTextDefault,
      termsUrl: survey.brand.termsUrl,
      privacyPolicyUrl: survey.brand.privacyPolicyUrl,
      memberIdentifierKind: survey.brand.memberIdentifierKind,
    }
  }, [survey])

  const themeForRender = survey?.theme ?? DEFAULT_THEME

  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!resolvedSurvey || !brandLite) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          answers,
          channel: 'link',
          consent: brandLite.consentMode === 'EXPLICIT' ? consentChecked : undefined,
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
        setError((body as { error?: string; message?: string }).message ?? `Submit failed (${res.status})`)
        return
      }
      setSubmitted(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [resolvedSurvey, brandLite, surveyId, token, answers, consentChecked])

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-gray-500">Loading…</p>
      </main>
    )
  }

  if (tokenState && tokenState !== 'valid') {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-base text-gray-900">{ERROR_COPY[tokenState]}</p>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-base text-gray-900">
            {survey?.thankYouMessage ?? 'Thank you for your feedback!'}
          </p>
          {survey?.thankYouRedirectUrl ? (
            <p className="mt-4">
              <a
                href={survey.thankYouRedirectUrl}
                className="text-sm text-indigo-600 hover:underline"
              >
                Continue →
              </a>
            </p>
          ) : null}
        </div>
      </main>
    )
  }

  if (!resolvedSurvey || !brandLite) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-red-600">{error ?? 'Failed to load survey.'}</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <SurveyFormRenderer
        survey={resolvedSurvey}
        theme={themeForRender}
        brand={brandLite}
        channel="standalone"
        viewport="desktop"
        mode="live"
        answers={answers}
        onAnswerChange={handleAnswerChange}
      />
      {/* Issue #378 — the member-id field is suppressed in token-authorized flow.
          The token resolves the member; the respondent never sees who they are. */}
      {brandLite.consentMode === 'EXPLICIT' && resolvedSurvey.consentTextOverride !== '' ? (
        <label className="mt-4 flex items-start gap-3 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1"
          />
          <span>
            {resolvedSurvey.consentTextOverride ??
              brandLite.consentTextDefault ??
              'I agree to share my feedback for the brand\'s use.'}
          </span>
        </label>
      ) : null}
      {error ? <RendererErrorLine slug="submit" message={error} /> : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-6 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </main>
  )
}
