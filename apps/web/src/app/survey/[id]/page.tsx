'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { API_URL } from '@/lib/config'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SkipCondition {
  sourceQuestionId: string
  operator: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'
  value?: unknown
}

interface SkipRule {
  targetQuestionId: string
  action: 'show' | 'hide'
  conditions: SkipCondition[]
  conditionLogic: 'AND' | 'OR'
}

interface QuestionConfig {
  min?: number
  max?: number
  step?: number
  labels?: { left?: string; right?: string }
  placeholder?: string
  maxLength?: number
  options?: string[]
  allowOther?: boolean
  rows?: string[]
  columns?: string[]
  scale?: string[]
  imageOptions?: { label: string; imageUrl: string }[]
  multiSelect?: boolean
  allowedTypes?: string[]
}

interface SurveyQuestion {
  id: string
  text: string
  type: string
  required?: boolean
  config?: QuestionConfig
  options?: string[] // legacy
  skipRules?: SkipRule[]
}

// Issue #291 — BrandTheme is the brand-level visual identity only.
// Per-survey thank-you fields moved to SurveyData; logo / brand-name moved to brand.
interface BrandTheme {
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  buttonColor?: string
  buttonTextColor?: string
  accentColor?: string
  fontFamily?: string
  borderRadius?: string
  cardStyle?: string
  maxWidth?: 'sm' | 'md' | 'lg'
}

interface SurveyData {
  id: string
  name: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  brand: { name: string; logoUrl?: string | null }
  questions: SurveyQuestion[]
  // Issue #291 — per-survey overrides on Survey (was on BrandTheme).
  // Issue #241 — `incentivePoints` + `showIncentivePoints` removed (D19/D40/D50):
  // points never appear on the form; earning is driven by EarningRule cx events.
  thankYouMessage?: string
  thankYouRedirectUrl?: string | null
  theme?: BrandTheme
  hasCxRules?: boolean
}

// Answer value can be many shapes depending on question type
type AnswerValue = number | string | string[] | Record<string, string> | null

interface Answer {
  questionId: string
  score?: number
  text?: string
  value?: AnswerValue
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-10 w-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

function defaultRatingRange(surveyType: SurveyType): { min: number; max: number } {
  switch (surveyType) {
    case 'NPS':  return { min: 0, max: 10 }
    case 'CSAT': return { min: 1, max: 5 }
    case 'CES':  return { min: 1, max: 7 }
    default:     return { min: 1, max: 5 }
  }
}

function defaultRatingLabel(surveyType: SurveyType): { low: string; high: string } {
  switch (surveyType) {
    case 'NPS':  return { low: 'Not likely', high: 'Extremely likely' }
    case 'CSAT': return { low: 'Very unsatisfied', high: 'Very satisfied' }
    case 'CES':  return { low: 'Strongly disagree', high: 'Strongly agree' }
    default:     return { low: 'Low', high: 'High' }
  }
}

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: '480px',
  md: '640px',
  lg: '800px',
}

/* ------------------------------------------------------------------ */
/*  Skip-logic evaluator                                              */
/* ------------------------------------------------------------------ */

function resolveAnswer(answers: Record<string, Answer>, questionId: string): AnswerValue {
  const a = answers[questionId]
  if (!a) return null
  if (a.value !== undefined) return a.value
  if (a.score !== undefined) return a.score
  if (a.text !== undefined) return a.text
  return null
}

function evalCondition(cond: SkipCondition, answers: Record<string, Answer>): boolean {
  const raw = resolveAnswer(answers, cond.sourceQuestionId)

  if (cond.operator === 'is_empty') {
    return raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)
  }
  if (cond.operator === 'is_not_empty') {
    return raw !== null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)
  }

  const numRaw = typeof raw === 'number' ? raw : Number(raw)
  const numVal = typeof cond.value === 'number' ? cond.value : Number(cond.value)
  const strRaw = String(raw ?? '')
  const strVal = String(cond.value ?? '')

  switch (cond.operator) {
    case 'eq':           return Array.isArray(raw) ? raw.includes(strVal) : strRaw === strVal
    case 'ne':           return Array.isArray(raw) ? !raw.includes(strVal) : strRaw !== strVal
    case 'lt':           return !isNaN(numRaw) && !isNaN(numVal) && numRaw < numVal
    case 'lte':          return !isNaN(numRaw) && !isNaN(numVal) && numRaw <= numVal
    case 'gt':           return !isNaN(numRaw) && !isNaN(numVal) && numRaw > numVal
    case 'gte':          return !isNaN(numRaw) && !isNaN(numVal) && numRaw >= numVal
    case 'contains':     return strRaw.includes(strVal)
    case 'not_contains': return !strRaw.includes(strVal)
    default:             return false
  }
}

function computeVisibility(
  questions: SurveyQuestion[],
  answers: Record<string, Answer>,
): Record<string, boolean> {
  // Gather all skip rules across all questions
  const allRules: SkipRule[] = []
  for (const q of questions) {
    if (q.skipRules) allRules.push(...q.skipRules)
  }

  // Default: everything visible
  const vis: Record<string, boolean> = {}
  for (const q of questions) vis[q.id] = true

  for (const rule of allRules) {
    const condResults = rule.conditions.map((c) => evalCondition(c, answers))
    const met = rule.conditionLogic === 'AND'
      ? condResults.every(Boolean)
      : condResults.some(Boolean)

    if (rule.action === 'show') {
      // show when met, hide when not met
      if (!met) vis[rule.targetQuestionId] = false
    } else {
      // hide when met
      if (met) vis[rule.targetQuestionId] = false
    }
  }

  return vis
}

/* ------------------------------------------------------------------ */
/*  Answer piping: replace {{Q1}} etc. in question text               */
/* ------------------------------------------------------------------ */

function pipeAnswers(
  text: string,
  questions: SurveyQuestion[],
  answers: Record<string, Answer>,
): string {
  return text.replace(/\{\{Q(\d+)\}\}/g, (_, num) => {
    const idx = parseInt(num, 10) - 1
    if (idx < 0 || idx >= questions.length) return ''
    const val = resolveAnswer(answers, questions[idx].id)
    if (val === null || val === undefined) return ''
    if (Array.isArray(val)) return val.join(', ')
    if (typeof val === 'object') return Object.values(val).join(', ')
    return String(val)
  })
}

/* ------------------------------------------------------------------ */
/*  Theme CSS custom properties                                       */
/* ------------------------------------------------------------------ */

function buildThemeStyle(theme?: BrandTheme): string {
  const t = theme ?? {}
  return `
    :root {
      --ceq-primary: ${t.primaryColor ?? '#4f46e5'};
      --ceq-bg: ${t.backgroundColor ?? '#f9fafb'};
      --ceq-text: ${t.textColor ?? '#111827'};
      --ceq-btn: ${t.buttonColor ?? '#4f46e5'};
      --ceq-btn-text: ${t.buttonTextColor ?? '#ffffff'};
      --ceq-accent: ${t.accentColor ?? '#7c3aed'};
      --ceq-font: ${t.fontFamily ?? 'inherit'};
    }
  `
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function SurveyResponsePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<SurveyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  // Fetch survey
  useEffect(() => {
    async function fetchSurvey() {
      try {
        const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Survey not found' : 'Failed to load survey')
        }
        const data = await res.json()
        setSurvey(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchSurvey()
  }, [surveyId])

  // Answer setter
  const setAnswer = useCallback((questionId: string, update: Partial<Answer>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, ...update },
    }))
  }, [])

  // Skip-logic visibility
  const visibility = useMemo(
    () => (survey ? computeVisibility(survey.questions, answers) : {}),
    [survey, answers],
  )

  // Overall score (only from visible rating questions)
  const computeOverallScore = useCallback((): number | undefined => {
    const ratingAnswers = Object.entries(answers)
      .filter(([qId, a]) => a.score !== undefined && visibility[qId] !== false)
      .map(([, a]) => a)
    if (ratingAnswers.length === 0) return undefined
    const sum = ratingAnswers.reduce((acc, a) => acc + (a.score ?? 0), 0)
    return Math.round(sum / ratingAnswers.length)
  }, [answers, visibility])

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      // Build answers map, excluding hidden questions
      const visibleAnswers = Object.fromEntries(
        Object.entries(answers)
          .filter(([qId]) => visibility[qId] !== false)
          .map(([qId, a]) => {
            if (a.value !== undefined && a.value !== null) return [qId, a.value]
            if (a.score !== undefined) return [qId, a.score]
            if (a.text !== undefined) return [qId, a.text]
            return [qId, null]
          }),
      )

      const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberEmail: email.trim(),
          answers: visibleAnswers,
          score: computeOverallScore(),
          channel: 'link',
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

      // Issue #291 — thankYouRedirectUrl moved from theme to Survey.
      if (survey?.thankYouRedirectUrl) {
        setTimeout(() => {
          window.location.href = survey!.thankYouRedirectUrl!
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---- Theme derived values ---- */
  const theme = survey?.theme
  const borderRadius = theme?.borderRadius ?? '0.75rem'
  const cardStyle = theme?.cardStyle ?? 'shadow-sm border border-gray-200'
  const maxWidthPx = MAX_WIDTH_MAP[theme?.maxWidth ?? ''] ?? '672px' // default ~max-w-2xl

  /* ---------------------------------------------------------------- */
  /*  Render states                                                   */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--ceq-bg, #f9fafb)' }}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle() }} />
        <Spinner />
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--ceq-bg, #f9fafb)' }}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle() }} />
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 max-w-md w-full text-center">
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (duplicate) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--ceq-bg, #f9fafb)', fontFamily: 'var(--ceq-font, inherit)' }}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(theme) }} />
        <div
          className={`w-full bg-white p-10 text-center ${cardStyle}`}
          style={{ maxWidth: maxWidthPx, borderRadius }}
        >
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--ceq-text)' }}>Already Responded</h2>
          <p className="mt-2 text-gray-600">
            {"You've already submitted a response to this survey. Thank you for your feedback!"}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    // Issue #291 — thankYouMessage moved from theme to Survey.
    const thankYouMsg = survey?.thankYouMessage ?? 'Your feedback has been submitted successfully.'
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--ceq-bg, #f9fafb)', fontFamily: 'var(--ceq-font, inherit)' }}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(theme) }} />
        <div
          className={`w-full bg-white p-10 text-center ${cardStyle}`}
          style={{ maxWidth: maxWidthPx, borderRadius }}
        >
          <div className="mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--ceq-primary) 15%, white)' }}>
            <svg className="h-7 w-7" style={{ color: 'var(--ceq-primary)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--ceq-text)' }}>Thank You!</h2>
          <p className="mt-2 text-gray-600">{thankYouMsg}</p>
          {/* Issue #241 — "You earned N points" badge removed (D19): points
              never appear on the form. Earning happens via EarningRule cx
              events on the response handler. */}
          {/* R8: CX rules exist — a loyalty/offer action may be triggered */}
          {survey?.hasCxRules && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-indigo-800">A special offer is on its way!</p>
              <p className="mt-0.5 text-xs text-indigo-600">Based on your feedback, we&apos;re preparing a personalized reward for you. Keep an eye on your inbox.</p>
            </div>
          )}
          {survey?.thankYouRedirectUrl && (
            <p className="mt-4 text-xs text-gray-400">Redirecting you shortly...</p>
          )}
        </div>
      </div>
    )
  }

  if (!survey) return null

  /* ---------------------------------------------------------------- */
  /*  Visible question index (for numbering)                          */
  /* ---------------------------------------------------------------- */

  let visibleIdx = 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--ceq-bg, #f9fafb)', fontFamily: 'var(--ceq-font, inherit)', color: 'var(--ceq-text, #111827)' }}>
      <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(theme) }} />

      {/* Header */}
      <div
        className="px-6 py-10 text-center"
        style={{
          background: `linear-gradient(to right, var(--ceq-primary, #4f46e5), var(--ceq-accent, #7c3aed))`,
          color: 'var(--ceq-btn-text, #ffffff)',
        }}
      >
        <div className="mx-auto" style={{ maxWidth: maxWidthPx }}>
          {/* Issue #291 — logoUrl moved from theme to Brand. */}
          {survey.brand.logoUrl && (
            <img src={survey.brand.logoUrl} alt={survey.brand.name} className="mx-auto mb-4 h-10 object-contain" />
          )}
          <p className="text-sm font-medium" style={{ opacity: 0.8 }}>
            {survey.brand.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{survey.name}</h1>
          {/* Issue #241 — "Earn N points" header badge removed (D19): points
              never appear on the form. */}
        </div>
      </div>

      {/* Survey Form */}
      <form onSubmit={handleSubmit} className="mx-auto px-4 py-8 sm:px-6" style={{ maxWidth: maxWidthPx }}>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email Field */}
        <div
          className={`mb-8 bg-white p-6 ${cardStyle}`}
          style={{ borderRadius }}
        >
          <label htmlFor="email" className="block text-sm font-semibold" style={{ color: 'var(--ceq-text)' }}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">Required so we can credit your account</p>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full px-3 py-2 border border-gray-300 text-sm focus:ring-2 focus:outline-none transition-shadow"
            style={{ borderRadius, focusRingColor: 'var(--ceq-primary)' } as React.CSSProperties}
          />
        </div>

        {/* Questions */}
        {survey.questions.map((q) => {
          if (visibility[q.id] === false) return null
          visibleIdx++
          const currentIdx = visibleIdx
          const pipedText = pipeAnswers(q.text, survey.questions, answers)

          return (
            <div
              key={q.id}
              className={`mb-6 bg-white p-6 ${cardStyle}`}
              style={{ borderRadius }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--ceq-text)' }}>
                <span className="mr-2" style={{ color: 'var(--ceq-primary)' }}>{currentIdx}.</span>
                {pipedText}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </p>

              <QuestionRenderer
                question={q}
                surveyType={survey.type}
                answer={answers[q.id]}
                setAnswer={setAnswer}
                borderRadius={borderRadius}
              />
            </div>
          )
        })}

        {/* Submit */}
        <div className="mt-8 text-center">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 hover:opacity-90 transition-opacity font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={{
              backgroundColor: 'var(--ceq-btn, #4f46e5)',
              color: 'var(--ceq-btn-text, #ffffff)',
              borderRadius,
            }}
          >
            {submitting && (
              <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            )}
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Multiple Choice (separate component to safely use hooks)          */
/* ------------------------------------------------------------------ */

function MultipleChoiceQuestion({
  questionId,
  options,
  allowOther,
  answer,
  setAnswer,
}: {
  questionId: string
  options: string[]
  allowOther: boolean
  answer: Answer | undefined
  setAnswer: (qId: string, update: Partial<Answer>) => void
}) {
  const [otherText, setOtherText] = useState('')
  const currentVal = (answer?.value as string) ?? answer?.text ?? ''
  const isOther = currentVal === '__other__'

  return (
    <div className="mt-3 space-y-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            name={`q-${questionId}`}
            checked={currentVal === opt}
            onChange={() => setAnswer(questionId, { value: opt, text: opt })}
            className="h-4 w-4"
            style={{ accentColor: 'var(--ceq-primary)' }}
          />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
      {allowOther && (
        <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            name={`q-${questionId}`}
            checked={isOther}
            onChange={() => setAnswer(questionId, { value: '__other__', text: otherText })}
            className="h-4 w-4"
            style={{ accentColor: 'var(--ceq-primary)' }}
          />
          <span className="text-sm">Other:</span>
          <input
            type="text"
            value={isOther ? (answer?.text ?? '') : otherText}
            onChange={(e) => {
              setOtherText(e.target.value)
              if (isOther) setAnswer(questionId, { value: '__other__', text: e.target.value })
            }}
            onFocus={() => {
              if (!isOther) setAnswer(questionId, { value: '__other__', text: otherText })
            }}
            placeholder="Please specify..."
            className="flex-1 px-2 py-1 border border-gray-300 text-sm rounded"
          />
        </label>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Question Renderer                                                 */
/* ------------------------------------------------------------------ */

interface QuestionRendererProps {
  question: SurveyQuestion
  surveyType: SurveyType
  answer: Answer | undefined
  setAnswer: (qId: string, update: Partial<Answer>) => void
  borderRadius: string
}

function QuestionRenderer({ question: q, surveyType, answer, setAnswer, borderRadius }: QuestionRendererProps) {
  const cfg = q.config ?? {}

  switch (q.type) {
    /* ---- Rating ---- */
    case 'rating': {
      const defaults = defaultRatingRange(surveyType)
      const min = cfg.min ?? defaults.min
      const max = cfg.max ?? defaults.max
      const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      const defLabels = defaultRatingLabel(surveyType)
      const leftLabel = cfg.labels?.left ?? defLabels.low
      const rightLabel = cfg.labels?.right ?? defLabels.high

      return (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {range.map((val) => {
              const selected = answer?.score === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswer(q.id, { score: val })}
                  className="h-10 min-w-[2.5rem] border text-sm font-medium transition-all"
                  style={{
                    borderRadius,
                    backgroundColor: selected ? 'var(--ceq-primary)' : '#ffffff',
                    borderColor: selected ? 'var(--ceq-primary)' : '#d1d5db',
                    color: selected ? 'var(--ceq-btn-text, #fff)' : '#374151',
                    transform: selected ? 'scale(1.1)' : undefined,
                    boxShadow: selected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : undefined,
                  }}
                >
                  {val}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>{leftLabel}</span>
            <span>{rightLabel}</span>
          </div>
        </div>
      )
    }

    /* ---- Text ---- */
    case 'text': {
      return (
        <textarea
          rows={3}
          maxLength={cfg.maxLength}
          value={answer?.text ?? ''}
          onChange={(e) => setAnswer(q.id, { text: e.target.value })}
          placeholder={cfg.placeholder ?? 'Type your answer here...'}
          className="mt-3 w-full px-3 py-2 border border-gray-300 text-sm focus:ring-2 focus:outline-none transition-shadow resize-none"
          style={{ borderRadius }}
        />
      )
    }

    /* ---- Multiple Choice / legacy choice ---- */
    case 'multiple_choice':
    case 'choice': {
      return (
        <MultipleChoiceQuestion
          questionId={q.id}
          options={cfg.options ?? q.options ?? []}
          allowOther={cfg.allowOther ?? false}
          answer={answer}
          setAnswer={setAnswer}
        />
      )
    }

    /* ---- Checkbox ---- */
    case 'checkbox': {
      const options = cfg.options ?? []
      const selected: string[] = (answer?.value as string[]) ?? []

      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
        setAnswer(q.id, { value: next })
      }

      return (
        <div className="mt-3 space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-4 w-4 rounded"
                style={{ accentColor: 'var(--ceq-primary)' }}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )
    }

    /* ---- Dropdown ---- */
    case 'dropdown': {
      const options = cfg.options ?? []
      return (
        <select
          value={(answer?.value as string) ?? ''}
          onChange={(e) => setAnswer(q.id, { value: e.target.value, text: e.target.value })}
          className="mt-3 w-full px-3 py-2 border border-gray-300 text-sm focus:ring-2 focus:outline-none transition-shadow bg-white"
          style={{ borderRadius }}
        >
          <option value="">Select an option...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    /* ---- Matrix ---- */
    case 'matrix': {
      const rows = cfg.rows ?? []
      const columns = cfg.columns ?? []
      const matrix: Record<string, string> = (answer?.value as Record<string, string>) ?? {}

      return (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left" />
                {columns.map((col) => (
                  <th key={col} className="p-2 text-center font-medium text-gray-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{row}</td>
                  {columns.map((col) => (
                    <td key={col} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`q-${q.id}-${row}`}
                        checked={matrix[row] === col}
                        onChange={() => {
                          const next = { ...matrix, [row]: col }
                          setAnswer(q.id, { value: next })
                        }}
                        className="h-4 w-4"
                        style={{ accentColor: 'var(--ceq-primary)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    /* ---- Ranking ---- */
    case 'ranking': {
      const options = cfg.options ?? []
      const ranked: string[] = (answer?.value as string[]) ?? [...options]

      // Initialize if not set
      if (!answer?.value && options.length > 0) {
        // Use a timeout to avoid setState during render
        setTimeout(() => setAnswer(q.id, { value: [...options] }), 0)
      }

      const moveUp = (idx: number) => {
        if (idx === 0) return
        const next = [...ranked]
        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
        setAnswer(q.id, { value: next })
      }

      const moveDown = (idx: number) => {
        if (idx >= ranked.length - 1) return
        const next = [...ranked]
        ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
        setAnswer(q.id, { value: next })
      }

      return (
        <div className="mt-3 space-y-1">
          {ranked.map((item, idx) => (
            <div key={item} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
              <span className="flex-1 text-sm">{item}</span>
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move up"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx >= ranked.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )
    }

    /* ---- Slider ---- */
    case 'slider': {
      const min = cfg.min ?? 0
      const max = cfg.max ?? 100
      const step = cfg.step ?? 1
      const val = (answer?.score ?? answer?.value ?? min) as number

      return (
        <div className="mt-4">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={val}
            onChange={(e) => {
              const n = Number(e.target.value)
              setAnswer(q.id, { score: n, value: n })
            }}
            className="w-full"
            style={{ accentColor: 'var(--ceq-primary)' }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{cfg.labels?.left ?? min}</span>
            <span className="font-semibold text-sm" style={{ color: 'var(--ceq-primary)' }}>{val}</span>
            <span>{cfg.labels?.right ?? max}</span>
          </div>
        </div>
      )
    }

    /* ---- Likert ---- */
    case 'likert': {
      const scale = cfg.scale ?? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      const currentVal = (answer?.value as string) ?? ''

      return (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {scale.map((label) => {
            const selected = currentVal === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => setAnswer(q.id, { value: label, text: label })}
                className="px-3 py-2 border text-xs font-medium transition-all"
                style={{
                  borderRadius,
                  backgroundColor: selected ? 'var(--ceq-primary)' : '#ffffff',
                  borderColor: selected ? 'var(--ceq-primary)' : '#d1d5db',
                  color: selected ? 'var(--ceq-btn-text, #fff)' : '#374151',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )
    }

    /* ---- Image Choice ---- */
    case 'image_choice': {
      const imageOptions = cfg.imageOptions ?? []
      const multiSelect = cfg.multiSelect ?? false
      const selected: string[] = multiSelect
        ? ((answer?.value as string[]) ?? [])
        : ((answer?.value as string) ? [answer!.value as string] : [])

      const toggle = (label: string) => {
        if (multiSelect) {
          const next = selected.includes(label) ? selected.filter((s) => s !== label) : [...selected, label]
          setAnswer(q.id, { value: next })
        } else {
          setAnswer(q.id, { value: label, text: label })
        }
      }

      return (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imageOptions.map((opt) => {
            const isSelected = selected.includes(opt.label)
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => toggle(opt.label)}
                className="flex flex-col items-center p-3 border-2 transition-all"
                style={{
                  borderRadius,
                  borderColor: isSelected ? 'var(--ceq-primary)' : '#e5e7eb',
                  backgroundColor: isSelected ? 'color-mix(in srgb, var(--ceq-primary) 5%, white)' : '#ffffff',
                }}
              >
                <img
                  src={opt.imageUrl}
                  alt={opt.label}
                  className="w-full h-24 object-cover rounded mb-2"
                />
                <span className="text-xs font-medium" style={{ color: isSelected ? 'var(--ceq-primary)' : '#374151' }}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      )
    }

    /* ---- File Upload ---- */
    case 'file_upload': {
      const acceptTypes = cfg.allowedTypes?.join(',') ?? ''
      const fileName = (answer?.text as string) ?? ''

      return (
        <div className="mt-3">
          <label
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
            style={{ borderRadius }}
          >
            <svg className="h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xs text-gray-500">
              {fileName || 'Click to upload a file'}
            </span>
            <input
              type="file"
              className="hidden"
              accept={acceptTypes}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setAnswer(q.id, { text: file.name, value: file.name })
                }
              }}
            />
          </label>
          {fileName && (
            <p className="mt-1 text-xs text-gray-500">Selected: {fileName}</p>
          )}
        </div>
      )
    }

    /* ---- Fallback ---- */
    default:
      return (
        <p className="mt-3 text-sm text-gray-400 italic">
          Unsupported question type: {q.type}
        </p>
      )
  }
}
