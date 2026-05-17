// Issue #241 — public respondent route.
//
// Renders the live survey form using the shared SurveyFormRenderer (Slice 4a)
// so the respondent view matches the editor's Look & Feel preview by
// construction. Previously this page carried a 1000-line bespoke renderer
// that diverged from the editor preview in chrome, theme tokens, rating
// labels, consent rendering, and submit button styling.
//
// Data shape comes from GET /v1/public/surveys/:id — that endpoint now
// returns title, settings (chromeMatrix), consentMode / consentTextOverride,
// brand consent/identity fields, and the full theme record. See
// apps/api/src/routes/public.ts:139.

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
  hasCxRules?: boolean
}

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

  const [survey, setSurvey] = useState<PublicSurveyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<AnswersState>({})
  // Issue #378 — the legacy ?email= query prefill is removed. The page no
  // longer reads identifier from the URL; respondents type it on the form.
  const [memberId, setMemberId] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  // Field-level validation errors. Populated on submit-attempt and cleared
  // when the operator fixes the offending field. Server failures still set
  // top-level `error`.
  const [fieldErrors, setFieldErrors] = useState<{
    memberId?: string
    consent?: string
    questions?: Record<string, string>
  }>({})

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Survey not found' : 'Failed to load survey')
        }
        const data = (await res.json()) as PublicSurveyPayload
        setSurvey(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchSurvey()
  }, [surveyId])

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
    // Clear the per-question error the moment the operator answers it.
    setFieldErrors((prev) => {
      if (!prev.questions?.[questionId]) return prev
      const nextQuestions = { ...prev.questions }
      delete nextQuestions[questionId]
      return { ...prev, questions: nextQuestions }
    })
  }, [])

  const handleMemberIdChange = useCallback((value: string) => {
    setMemberId(value)
    if (value.trim()) {
      setFieldErrors((prev) => (prev.memberId ? { ...prev, memberId: undefined } : prev))
    }
  }, [])

  const handleConsentChange = useCallback((next: boolean) => {
    setConsentChecked(next)
    if (next) {
      setFieldErrors((prev) => (prev.consent ? { ...prev, consent: undefined } : prev))
    }
  }, [])

  function isAnswerMissing(value: unknown): boolean {
    if (value === undefined || value === null) return true
    if (typeof value === 'string') return value.trim().length === 0
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value as object).length === 0
    return false
  }

  async function handleSubmit() {
    if (!resolvedSurvey || !brandLite) return

    // Client-side validation: required identifier, required-question
    // answers, explicit-consent checkbox. Surfaced as inline field errors
    // (next to each control) so the operator sees what's missing without
    // a generic banner.
    const effectiveMode = resolvedSurvey.consentMode ?? brandLite.consentMode
    const explicit = effectiveMode === 'EXPLICIT'
    const nextQuestionErrors: Record<string, string> = {}
    for (const q of resolvedSurvey.questions) {
      if (!q.required) continue
      if (isAnswerMissing(answers[q.id])) {
        nextQuestionErrors[q.id] = 'This question is required.'
      }
    }
    const nextErrors: typeof fieldErrors = {}
    if (!memberId.trim()) {
      nextErrors.memberId = `${memberIdLabel(brandLite.memberIdentifierKind)} is required.`
    }
    if (explicit && !consentChecked) {
      nextErrors.consent = 'Please confirm you agree before submitting.'
    }
    if (Object.keys(nextQuestionErrors).length > 0) {
      nextErrors.questions = nextQuestionErrors
    }

    const hasErrors =
      !!nextErrors.memberId || !!nextErrors.consent || !!nextErrors.questions
    if (hasErrors) {
      setFieldErrors(nextErrors)
      // Scroll the first errored element into view so the operator sees it.
      // Run on next tick so the error nodes are in the DOM first.
      setTimeout(() => {
        const target = document.querySelector('[data-error]') as HTMLElement | null
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 0)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    setError(null)

    try {
      // Build answers excluding hidden (skip-rule-filtered) questions —
      // skip-rule evaluation lives in the renderer; we trust answers state
      // here since the renderer only writes through onAnswerChange for
      // visible questions.
      const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberEmail: memberId.trim(),
          answers,
          channel: 'link',
          // R10 / R11: when effective consent mode is EXPLICIT, the API
          // requires `consent: true` in the body. We always send the box's
          // current state — server still rejects (400 CONSENT_REQUIRED) if
          // the box is unchecked, which matches the visible UI gate.
          consent: consentChecked,
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

      setSubmitted(true)

      if (survey?.thankYouRedirectUrl) {
        setTimeout(() => {
          window.location.href = survey.thankYouRedirectUrl as string
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          {error}
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

  if (submitted) {
    const thankYouMsg = survey?.thankYouMessage ?? 'Your feedback has been submitted.'
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Thank you!</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{thankYouMsg}</p>
          {survey?.thankYouRedirectUrl && (
            <p className="mt-4 text-xs text-gray-400">Redirecting you shortly…</p>
          )}
        </div>
      </div>
    )
  }

  if (!resolvedSurvey || !brandLite) return null

  // The submit button is intentionally NOT blocked on missing fields —
  // clicking with errors triggers inline messages next to the offending
  // field (and a scroll-to-first-error) so the operator sees what's
  // wrong. Only block while a request is in flight.
  const submitBlocked = submitting

  // R15: member-id field rendered above the questions inside the renderer's
  // form. Live mode collects the value here; the renderer is agnostic.
  const memberIdError = fieldErrors.memberId
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
          {memberIdLabel(brandLite.memberIdentifierKind)} <span style={{ color: 'var(--ceq-accent-color)' }}>*</span>
        </span>
        <input
          type={memberIdInputType(brandLite.memberIdentifierKind)}
          value={memberId}
          onChange={(e) => handleMemberIdChange(e.target.value)}
          aria-invalid={memberIdError ? 'true' : 'false'}
          placeholder={brandLite.memberIdentifierKind === 'email' ? 'you@example.com' : ''}
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
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <SurveyFormRenderer
          survey={resolvedSurvey}
          theme={themeForRender}
          brand={brandLite}
          channel="standalone"
          viewport="desktop"
          mode="live"
          answers={answers}
          onAnswerChange={handleAnswerChange}
          consentChecked={consentChecked}
          onConsentCheckedChange={handleConsentChange}
          errors={{ consent: fieldErrors.consent, questions: fieldErrors.questions }}
          prefixSlot={memberIdField}
          onSubmit={handleSubmit}
          submitLabel={submitting ? 'Submitting…' : 'Submit'}
          submitDisabled={submitBlocked}
        />
      </div>
    </div>
  )
}
