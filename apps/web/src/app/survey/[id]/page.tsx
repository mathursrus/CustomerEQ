'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface SurveyQuestion {
  id: string
  text: string
  type: 'rating' | 'text'
}

interface SurveyData {
  id: string
  name: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  brand: { name: string }
  questions: SurveyQuestion[]
  incentivePoints?: number
}

interface Answer {
  questionId: string
  score?: number
  text?: string
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-10 w-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )
}

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

function ratingRange(surveyType: SurveyType): number[] {
  switch (surveyType) {
    case 'NPS':
      return Array.from({ length: 11 }, (_, i) => i) // 0-10
    case 'CSAT':
      return Array.from({ length: 5 }, (_, i) => i + 1) // 1-5
    case 'CES':
      return Array.from({ length: 7 }, (_, i) => i + 1) // 1-7
    case 'CUSTOM':
    default:
      return Array.from({ length: 5 }, (_, i) => i + 1) // 1-5 fallback
  }
}

function ratingLabel(surveyType: SurveyType): { low: string; high: string } {
  switch (surveyType) {
    case 'NPS':
      return { low: 'Not likely', high: 'Extremely likely' }
    case 'CSAT':
      return { low: 'Very unsatisfied', high: 'Very satisfied' }
    case 'CES':
      return { low: 'Strongly disagree', high: 'Strongly agree' }
    case 'CUSTOM':
    default:
      return { low: 'Low', high: 'High' }
  }
}

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

  const setAnswer = useCallback((questionId: string, update: Partial<Answer>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, ...update },
    }))
  }, [])

  const computeOverallScore = useCallback((): number | undefined => {
    const ratingAnswers = Object.values(answers).filter((a) => a.score !== undefined)
    if (ratingAnswers.length === 0) return undefined
    const sum = ratingAnswers.reduce((acc, a) => acc + (a.score ?? 0), 0)
    return Math.round(sum / ratingAnswers.length)
  }, [answers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/public/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberEmail: email.trim(),
          answers: Object.fromEntries(
            Object.entries(answers).map(([qId, a]) => [qId, a.score ?? a.text ?? null]),
          ),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner />
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 max-w-md w-full text-center">
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (duplicate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-2xl bg-white shadow-sm border border-gray-200 p-10 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Already Responded</h2>
          <p className="mt-2 text-gray-600">
            {"You've already submitted a response to this survey. Thank you for your feedback!"}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-2xl bg-white shadow-sm border border-gray-200 p-10 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Thank You!</h2>
          <p className="mt-2 text-gray-600">
            Your feedback has been submitted successfully.
          </p>
          {survey?.incentivePoints && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              You earned {survey.incentivePoints} points!
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!survey) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-10 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-indigo-200">{survey.brand.name}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{survey.name}</h1>
          {survey.incentivePoints && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Earn {survey.incentivePoints} points for completing this survey!
            </div>
          )}
        </div>
      </div>

      {/* Survey Form */}
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email Field */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label htmlFor="email" className="block text-sm font-semibold text-gray-900">
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
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
          />
        </div>

        {/* Questions */}
        {survey.questions.map((q, idx) => (
          <div key={q.id} className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              <span className="mr-2 text-indigo-600">{idx + 1}.</span>
              {q.text}
            </p>

            {q.type === 'text' ? (
              <textarea
                rows={3}
                value={answers[q.id]?.text ?? ''}
                onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                placeholder="Type your answer here..."
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow resize-none"
              />
            ) : (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2 justify-center">
                  {ratingRange(survey.type).map((val) => {
                    const selected = answers[q.id]?.score === val
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAnswer(q.id, { score: val })}
                        className={`h-10 min-w-[2.5rem] rounded-lg border text-sm font-medium transition-all ${
                          selected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-110'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                        }`}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span>{ratingLabel(survey.type).low}</span>
                  <span>{ratingLabel(survey.type).high}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Submit */}
        <div className="mt-8 text-center">
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting && (
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </form>
    </div>
  )
}
