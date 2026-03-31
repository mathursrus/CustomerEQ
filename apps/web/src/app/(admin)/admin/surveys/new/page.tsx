'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface Program {
  id: string
  name: string
}

interface FormData {
  name: string
  programId: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  incentivePoints: string
}

interface SurveyQuestion {
  id: string
  text: string
  type: 'rating' | 'text'
  required: boolean
}

const DEFAULT_QUESTIONS: Record<string, SurveyQuestion[]> = {
  NPS: [
    { id: 'q1', text: 'On a scale of 0-10, how likely are you to recommend us to a friend or colleague?', type: 'rating', required: true },
    { id: 'q2', text: 'What is the primary reason for your score?', type: 'text', required: false },
  ],
  CSAT: [
    { id: 'q1', text: 'How satisfied are you with your recent experience? (1-5)', type: 'rating', required: true },
    { id: 'q2', text: 'What could we do to improve?', type: 'text', required: false },
  ],
  CES: [
    { id: 'q1', text: 'How easy was it to resolve your issue today? (1-7)', type: 'rating', required: true },
    { id: 'q2', text: 'What would have made the process easier?', type: 'text', required: false },
  ],
  CUSTOM: [
    { id: 'q1', text: 'How was your experience?', type: 'text', required: true },
  ],
}

export default function NewSurveyPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [form, setForm] = useState<FormData>({
    name: '',
    programId: '',
    type: 'NPS',
    incentivePoints: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPrograms() {
      try {
        const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/programs`, { headers })
        if (res.ok) {
          const data = await res.json()
          setPrograms(data.data ?? data.programs ?? (Array.isArray(data) ? data : []))
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err)
      }
    }
    fetchPrograms()
  }, [getToken])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Survey name is required'
    if (!form.programId) errs.programId = 'Program is required'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setServerError(null)
    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        programId: form.programId,
        type: form.type,
        questions: DEFAULT_QUESTIONS[form.type],
      }
      if (form.incentivePoints.trim()) {
        payload.incentivePoints = Number(form.incentivePoints)
      }

      const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/surveys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? `Failed with status ${res.status}`)
      }
      const created = await res.json()
      router.push(`/admin/surveys/${created.id}`)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const questions = DEFAULT_QUESTIONS[form.type] ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Survey</h1>
        <p className="mt-1 text-sm text-gray-500">Set up a new customer feedback survey</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {serverError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="surveyName" className="block text-sm font-medium text-gray-700 mb-1">
              Survey Name <span className="text-red-500">*</span>
            </label>
            <input
              id="surveyName"
              type="text"
              data-testid="survey-name-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. Post-Purchase NPS Survey"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="programId" className="block text-sm font-medium text-gray-700 mb-1">
              Program <span className="text-red-500">*</span>
            </label>
            <select
              id="programId"
              data-testid="survey-program-select"
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.programId ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select a program...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.programId && <p className="mt-1 text-xs text-red-600">{errors.programId}</p>}
          </div>

          <div>
            <label htmlFor="surveyType" className="block text-sm font-medium text-gray-700 mb-1">
              Survey Type
            </label>
            <select
              id="surveyType"
              data-testid="survey-type-select"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormData['type'] }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="NPS">NPS - Net Promoter Score</option>
              <option value="CSAT">CSAT - Customer Satisfaction</option>
              <option value="CES">CES - Customer Effort Score</option>
              <option value="CUSTOM">Custom Survey</option>
            </select>
          </div>

          <div>
            <label htmlFor="incentivePoints" className="block text-sm font-medium text-gray-700 mb-1">
              Incentive Points <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="incentivePoints"
              type="number"
              data-testid="survey-incentive-input"
              value={form.incentivePoints}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, incentivePoints: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Points awarded for completing the survey"
            />
          </div>

          {/* Question Preview */}
          {questions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Default Questions Preview</p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm text-gray-700">{q.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{q.type === 'rating' ? 'Rating' : 'Open text'}{q.required ? '' : ' (optional)'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">You can customize questions after creation.</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              data-testid="survey-submit-btn"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
