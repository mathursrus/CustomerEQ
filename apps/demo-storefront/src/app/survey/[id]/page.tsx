'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getPersonaEmail } from '@/lib/persona'

const BRAND_NAME = process.env.NEXT_PUBLIC_DEMO_BRAND_NAME ?? 'Demo Brand'
// Deliberately not coupled to @customerEQ/shared — demo simulates a 3rd-party
// storefront with zero workspace deps (see account/page.tsx note).
const ADMIN_URL = process.env.NEXT_PUBLIC_DEMO_WEB_URL ?? 'https://customereq.wellnessatwork.me'

interface Question {
  id: string
  text: string
  type: 'rating' | 'text' | 'multiple_choice'
  required?: boolean
  config?: {
    min?: number
    max?: number
    labels?: { left?: string; right?: string }
    options?: string[]
    placeholder?: string
  }
}

interface SurveyData {
  id: string
  name: string
  type: string
  questions: Question[]
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'survey'; data: SurveyData; email: string }
  | { phase: 'submitting' }
  | { phase: 'done'; incentivePoints: number }
  | { phase: 'error'; message: string }

export default function SurveyPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  useEffect(() => {
    async function load() {
      const email = searchParams.get('email') ?? getPersonaEmail()
      if (!email) {
        setState({ phase: 'error', message: 'No persona selected. Pick one from the header or include ?email= in the URL.' })
        return
      }

      try {
        const res = await fetch(`/api/storefront/survey/${id}`)
        if (!res.ok) {
          setState({ phase: 'error', message: 'Survey not found or not active.' })
          return
        }
        const data = await res.json() as SurveyData
        setState({ phase: 'survey', data, email })
      } catch {
        setState({ phase: 'error', message: 'Could not load survey. Is the API running?' })
      }
    }
    void load()
  }, [id, searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.phase !== 'survey') return

    const { data, email } = state
    const ratingQ = data.questions.find((q) => q.type === 'rating')
    const score = ratingQ && answers[ratingQ.id] !== undefined
      ? Number(answers[ratingQ.id])
      : undefined

    setState({ phase: 'submitting' })

    try {
      const res = await fetch(`/api/storefront/survey/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberEmail: email, answers, score, channel: 'link', consent: true }),
      })
      const result = await res.json() as { duplicate?: boolean; error?: string }

      if (!res.ok && !result.duplicate) {
        setState({ phase: 'error', message: result.error ?? 'Submission failed.' })
        return
      }

      // Issue #241 removed incentivePoints from the survey submission API response;
      // earning is driven by EarningRule cx events. Hardcode the fixture default (50)
      // matching the seed's Survey Completion Bonus rule, same as checkout/confirm/page.tsx.
      setState({ phase: 'done', incentivePoints: 50 })
    } catch {
      setState({ phase: 'error', message: 'Network error. Is the API running?' })
    }
  }

  if (state.phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm text-red-600">{state.message}</p>
      </div>
    )
  }

  if (state.phase === 'done') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 text-white"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          ✓
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your feedback helps us make every cup better.
        </p>
        {state.incentivePoints != null && state.incentivePoints > 0 && (
          <div
            className="rounded-lg p-3 text-sm font-semibold mb-6"
            style={{ backgroundColor: '#f0faf5', color: 'var(--brand-primary)' }}
          >
            +{state.incentivePoints} StarPoints earned!
          </div>
        )}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 text-left">
          <p className="font-semibold mb-1">Demo tip: watch the CX pipeline</p>
          <p>Check the <a href={`${ADMIN_URL}/admin/alerts/cases`} className="underline" target="_blank" rel="noreferrer">alert cases</a> or <a href={`${ADMIN_URL}/admin/campaigns`} className="underline" target="_blank" rel="noreferrer">campaigns</a> in the admin dashboard to see the recovery flow trigger.</p>
        </div>
      </div>
    )
  }

  if (state.phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
        <p className="text-sm text-gray-500">Submitting your feedback…</p>
      </div>
    )
  }

  const { data, email } = state

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-2 text-xs text-gray-400">{BRAND_NAME}</div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{data.name}</h1>

      <div className="mb-4 text-xs text-gray-500">
        Responding as: <strong>{email}</strong>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {data.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            surveyType={data.type}
            value={answers[q.id]}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          />
        ))}

        <button
          type="submit"
          className="w-full text-sm font-semibold text-white py-3 rounded-lg transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          data-testid="submit-survey-btn"
        >
          Submit Feedback
        </button>
      </form>
    </div>
  )
}

function QuestionField({
  question,
  surveyType,
  value,
  onChange,
}: {
  question: Question
  surveyType: string
  value: unknown
  onChange: (val: unknown) => void
}) {
  if (question.type === 'rating') {
    const min = question.config?.min ?? (surveyType === 'NPS' ? 0 : 1)
    const max = question.config?.max ?? (surveyType === 'NPS' ? 10 : 5)
    const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min)

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">{question.text}</label>
        {question.config?.labels && (
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{question.config.labels.left}</span>
            <span>{question.config.labels.right}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="w-10 h-10 rounded-lg border text-sm font-semibold transition-all cursor-pointer"
              style={
                value === n
                  ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#d1d5db', color: '#374151' }
              }
              aria-pressed={value === n}
              data-testid={`rating-${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === 'text') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{question.text}</label>
        <textarea
          rows={3}
          placeholder={question.config?.placeholder ?? 'Your feedback…'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 resize-vertical"
          style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
          data-testid={`text-${question.id}`}
        />
      </div>
    )
  }

  if (question.type === 'multiple_choice') {
    const options = question.config?.options ?? []
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{question.text}</label>
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-[var(--brand-primary)]"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return null
}
