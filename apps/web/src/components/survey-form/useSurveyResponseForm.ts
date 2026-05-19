// Issue #378 — shared host-page glue for the live respondent surfaces.
//
// Both the public BYO-member-id page (apps/web/src/app/survey/[id]/page.tsx)
// and the tokenized page (apps/web/src/app/survey/[id]/r/[token]/page.tsx)
// wrap the same SurveyFormRenderer but each used to re-implement the
// surrounding glue — survey/brand fetch, answers/consent/memberId state,
// required-question + explicit-consent validation, error wiring. That
// duplication caused #378's inline-error regression. This hook collapses
// the shared glue so each page only owns its own identity gate and POST.
//
// Validation contract matches issue #241: errors render inline right below
// the offending control via the `errors` prop on SurveyFormRenderer.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { API_URL } from '@/lib/config'

import type { AnswersState, BrandLite, BrandThemeLite, SurveyResolved } from './types'

export interface PublicSurveyPayload {
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

export const DEFAULT_THEME: BrandThemeLite = {
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

export interface FieldErrors {
  memberId?: string
  consent?: string
  questions?: Record<string, string>
}

export interface UseSurveyResponseFormOptions {
  surveyId: string
  /**
   * When true, the surrounding host page authorizes identity out-of-band
   * (e.g. via a token) and the member-id field is suppressed. validate()
   * skips the member-id check in that case.
   */
  identityFromToken?: boolean
  /**
   * Label used inside the "X is required" message when memberId validation
   * fires. Caller supplies because the label is identifier-kind-aware
   * ("Your email" / "Your phone" / "Your customer ID").
   */
  memberIdRequiredMessage?: () => string
  /**
   * Whether to actually issue the survey fetch. The tokenized page only
   * fetches once its token-status preflight resolves to 'valid'.
   * Defaults to true.
   */
  enabled?: boolean
}

export interface UseSurveyResponseForm {
  survey: PublicSurveyPayload | null
  resolvedSurvey: SurveyResolved | null
  brandLite: BrandLite | null
  theme: BrandThemeLite
  loading: boolean
  loadError: string | null

  answers: AnswersState
  consentChecked: boolean
  memberId: string
  fieldErrors: FieldErrors

  submitting: boolean
  setSubmitting: (b: boolean) => void
  submitted: boolean
  setSubmitted: (b: boolean) => void
  error: string | null
  setError: (e: string | null) => void

  handleAnswerChange: (questionId: string, value: unknown) => void
  handleConsentChange: (next: boolean) => void
  handleMemberIdChange: (value: string) => void

  /**
   * Run required-question + explicit-consent (+ optional member-id)
   * validation. Returns true if clean; otherwise populates fieldErrors,
   * scrolls the first errored control into view, and returns false.
   */
  validate: () => boolean
  /**
   * Effective consent mode (survey override ?? brand default). Pages pass
   * this through to the POST body so the API's CONSENT_REQUIRED check
   * matches the visible UI gate.
   */
  effectiveConsentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT' | null
}

function isAnswerMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

export function useSurveyResponseForm(
  options: UseSurveyResponseFormOptions,
): UseSurveyResponseForm {
  const { surveyId, identityFromToken = false, memberIdRequiredMessage, enabled = true } = options

  const [survey, setSurvey] = useState<PublicSurveyPayload | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<AnswersState>({})
  const [memberId, setMemberId] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function fetchSurvey() {
      try {
        const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Survey not found' : 'Failed to load survey')
        }
        const data = (await res.json()) as PublicSurveyPayload
        if (!cancelled) setSurvey(data)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Something went wrong')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchSurvey()
    return () => {
      cancelled = true
    }
  }, [surveyId, enabled])

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

  const theme = survey?.theme ?? DEFAULT_THEME

  const effectiveConsentMode = resolvedSurvey
    ? (resolvedSurvey.consentMode ?? brandLite?.consentMode ?? null)
    : null

  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setFieldErrors((prev) => {
      if (!prev.questions?.[questionId]) return prev
      const nextQuestions = { ...prev.questions }
      delete nextQuestions[questionId]
      return { ...prev, questions: nextQuestions }
    })
  }, [])

  const handleConsentChange = useCallback((next: boolean) => {
    setConsentChecked(next)
    if (next) {
      setFieldErrors((prev) => (prev.consent ? { ...prev, consent: undefined } : prev))
    }
  }, [])

  const handleMemberIdChange = useCallback((value: string) => {
    setMemberId(value)
    if (value.trim()) {
      setFieldErrors((prev) => (prev.memberId ? { ...prev, memberId: undefined } : prev))
    }
  }, [])

  const validate = useCallback((): boolean => {
    if (!resolvedSurvey || !brandLite) return false

    const explicit = effectiveConsentMode === 'EXPLICIT'
    const nextQuestionErrors: Record<string, string> = {}
    for (const q of resolvedSurvey.questions) {
      if (!q.required) continue
      if (isAnswerMissing(answers[q.id])) {
        nextQuestionErrors[q.id] = 'This question is required.'
      }
    }
    const nextErrors: FieldErrors = {}
    if (!identityFromToken && !memberId.trim()) {
      nextErrors.memberId = memberIdRequiredMessage
        ? memberIdRequiredMessage()
        : 'This field is required.'
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
      setTimeout(() => {
        const target = document.querySelector('[data-error]') as HTMLElement | null
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 0)
      return false
    }
    setFieldErrors({})
    return true
  }, [
    resolvedSurvey,
    brandLite,
    effectiveConsentMode,
    answers,
    consentChecked,
    memberId,
    identityFromToken,
    memberIdRequiredMessage,
  ])

  return {
    survey,
    resolvedSurvey,
    brandLite,
    theme,
    loading,
    loadError,

    answers,
    consentChecked,
    memberId,
    fieldErrors,

    submitting,
    setSubmitting,
    submitted,
    setSubmitted,
    error,
    setError,

    handleAnswerChange,
    handleConsentChange,
    handleMemberIdChange,

    validate,
    effectiveConsentMode,
  }
}
