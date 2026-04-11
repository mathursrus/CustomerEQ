'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import TriggerStep from '@/components/surveys/TriggerStep'
import RuleBuilderStep, { type SurveyRuleInput } from '@/components/surveys/RuleBuilderStep'
import ReviewLaunchStep from '@/components/surveys/ReviewLaunchStep'
import { getTriggerRecommendation } from '@/utils/triggerRecommendation'

interface Program {
  id: string
  name: string
  budgetUsdCents?: number | null
  monthlyBudgetUsdCents?: number | null
}

interface FormData {
  name: string
  programId: string
  incentivePoints: string
  surveyType: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
}

interface TriggerData {
  category: string
  key: string
  surveyTypeOverride?: string
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

// Step labels per path
const TRIGGERED_STEP_LABELS = ['Trigger', 'Survey Details', 'What Happens Next?', 'Review & Launch']
const ADHOC_STEP_LABELS = ['Survey Details', 'What Happens Next?', 'Review & Launch']

export default function NewSurveyPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])

  // pathMode: null = path selection screen, 'adhoc' = no trigger, 'triggered' = full wizard
  const [pathMode, setPathMode] = useState<null | 'adhoc' | 'triggered'>(null)

  // In triggered mode: 4 steps (1=Trigger, 2=Details, 3=Rules, 4=Review)
  // In adhoc mode: 3 steps (1=Details, 2=Rules, 3=Review) — steps mapped to same render slots
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [triggerData, setTriggerData] = useState<TriggerData | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    programId: '',
    incentivePoints: '',
    surveyType: 'NPS',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [createdSurveyId, setCreatedSurveyId] = useState<string | null>(null)
  const [rules, setRules] = useState<SurveyRuleInput[]>([])

  useEffect(() => {
    async function fetchPrograms() {
      try {
        const token = await getAuthToken(getToken)
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

  const selectedProgram = programs.find((p) => p.id === form.programId) ?? null

  function handleSelectPath(mode: 'adhoc' | 'triggered') {
    setPathMode(mode)
    setStep(1)
    setTriggerData(null)
    setCreatedSurveyId(null)
    setRules([])
    setErrors({})
    setServerError(null)
  }

  function handleTriggerContinue(data: TriggerData) {
    setTriggerData(data)
    setStep(2)
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Survey name is required'
    if (!form.programId) errs.programId = 'Program is required'
    return errs
  }

  // Survey details step: create survey in DRAFT, then advance to rules step
  async function handleSurveyDetailsSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setServerError(null)
    setSubmitting(true)

    try {
      let surveyType: string
      if (pathMode === 'adhoc') {
        surveyType = form.surveyType
      } else {
        const recommendation = triggerData ? getTriggerRecommendation(triggerData.key) : null
        surveyType = triggerData?.surveyTypeOverride ?? recommendation?.type ?? 'NPS'
      }

      const payload: Record<string, unknown> = {
        name: form.name,
        programId: form.programId,
        type: surveyType,
        questions: DEFAULT_QUESTIONS[surveyType] ?? DEFAULT_QUESTIONS.NPS,
      }
      if (form.incentivePoints.trim()) {
        payload.incentivePoints = Number(form.incentivePoints)
      }
      if (pathMode === 'triggered' && triggerData) {
        payload.triggerCategory = triggerData.category
        payload.triggerKey = triggerData.key
        if (triggerData.surveyTypeOverride) {
          payload.surveyTypeOverride = triggerData.surveyTypeOverride
        }
      }

      const token = await getAuthToken(getToken)
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
      setCreatedSurveyId(created.id)
      // In triggered mode: step 2→3; in adhoc mode: step 1→2
      setStep(pathMode === 'triggered' ? 3 : 2)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRulesContinue(confirmedRules: SurveyRuleInput[]) {
    setRules(confirmedRules)
    setStep(pathMode === 'triggered' ? 4 : 3)
  }

  function handleSkipRules() {
    setRules([])
    setStep(pathMode === 'triggered' ? 4 : 3)
  }

  function handleLaunched() {
    if (createdSurveyId) {
      router.push(`/admin/surveys/${createdSurveyId}`)
    }
  }

  // Resolve active survey type for downstream steps
  const resolvedSurveyType = (
    pathMode === 'adhoc'
      ? form.surveyType
      : (triggerData?.surveyTypeOverride ?? (triggerData ? getTriggerRecommendation(triggerData.key)?.type : undefined) ?? 'NPS')
  ) as 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

  // Step indicator config by path
  const stepLabels = pathMode === 'triggered' ? TRIGGERED_STEP_LABELS : ADHOC_STEP_LABELS
  // For adhoc: visible steps 1-3; for triggered: visible steps 1-4
  // When pathMode is null (path selection), hide the indicator

  // Which "render slot" maps to which visual step number
  // triggered: step 1=Trigger, 2=Details, 3=Rules, 4=Review
  // adhoc:     step 1=Details, 2=Rules, 3=Review
  function getVisualStep(): number {
    if (pathMode === 'triggered') return step
    // adhoc: step 1→1, 2→2, 3→3
    return step
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Survey</h1>
        <p className="mt-1 text-sm text-gray-500">Set up a new customer feedback survey</p>
      </div>

      {/* Path selection — shown before any step */}
      {pathMode === null && (
        <div data-testid="survey-path-selection">
          <p className="text-sm text-gray-600 mb-4">How would you like to create your survey?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              data-testid="path-adhoc"
              onClick={() => handleSelectPath('adhoc')}
              className="flex flex-col items-start gap-2 rounded-xl border-2 border-gray-200 bg-white p-6 text-left hover:border-indigo-400 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span className="text-2xl">📋</span>
              <span className="text-base font-semibold text-gray-900">Create a survey</span>
              <span className="text-sm text-gray-500">
                Quick ad-hoc survey — name, program, type. Distribute manually via link or embed. No trigger required.
              </span>
            </button>
            <button
              type="button"
              data-testid="path-triggered"
              onClick={() => handleSelectPath('triggered')}
              className="flex flex-col items-start gap-2 rounded-xl border-2 border-gray-200 bg-white p-6 text-left hover:border-indigo-400 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span className="text-2xl">⚡</span>
              <span className="text-base font-semibold text-gray-900">Set up a triggered survey</span>
              <span className="text-sm text-gray-500">
                Survey sent automatically when a loyalty or CX event fires (e.g. tier upgrade, enrollment, support resolved).
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step indicator — only shown when a path is chosen */}
      {pathMode !== null && (
        <div className="flex items-center gap-2 mb-6" data-testid="step-indicator">
          {stepLabels.map((label, idx) => {
            const stepNum = (idx + 1) as 1 | 2 | 3 | 4
            const visualStep = getVisualStep()
            const active = visualStep === stepNum
            const done = visualStep > stepNum
            return (
              <div key={stepNum} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? '✓' : stepNum}
                  </span>
                  {label}
                </div>
                {idx < stepLabels.length - 1 && (
                  <div className="h-px flex-1 bg-gray-200" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {pathMode !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          {/* TRIGGERED PATH — Step 1: Trigger wizard */}
          {pathMode === 'triggered' && step === 1 && (
            <div>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setPathMode(null)}
                  className="text-xs text-gray-400 underline hover:text-gray-600"
                >
                  ← Change survey type
                </button>
              </div>
              <TriggerStep
                programs={programs}
                getToken={getToken}
                onContinue={handleTriggerContinue}
              />
            </div>
          )}

          {/* Survey details form — step 2 in triggered mode, step 1 in adhoc mode */}
          {((pathMode === 'triggered' && step === 2) || (pathMode === 'adhoc' && step === 1)) && (
            <div data-testid="survey-content-step">
              {serverError && (
                <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              {/* Trigger summary pill — triggered path only */}
              {pathMode === 'triggered' && triggerData && (
                <div className="mb-5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                    {triggerData.category} / {triggerData.key}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    Change
                  </button>
                </div>
              )}

              <form onSubmit={handleSurveyDetailsSubmit} className="space-y-5">
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
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.programId ? 'border-red-400' : 'border-gray-300'}`}
                  >
                    <option value="">Select a program...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {errors.programId && <p className="mt-1 text-xs text-red-600">{errors.programId}</p>}
                </div>

                {/* Survey type selector — ad-hoc path only (triggered path gets type from wizard) */}
                {pathMode === 'adhoc' && (
                  <div>
                    <label htmlFor="surveyType" className="block text-sm font-medium text-gray-700 mb-1">
                      Survey Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="surveyType"
                      data-testid="survey-type-select"
                      value={form.surveyType}
                      onChange={(e) => setForm((f) => ({ ...f, surveyType: e.target.value as FormData['surveyType'] }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="NPS">NPS — Net Promoter Score</option>
                      <option value="CSAT">CSAT — Customer Satisfaction</option>
                      <option value="CES">CES — Customer Effort Score</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                )}

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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Points awarded for completing the survey"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (pathMode === 'triggered') setStep(1)
                      else setPathMode(null)
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    data-testid="survey-submit-btn"
                    disabled={submitting}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Creating...' : 'Continue: Set Up Rules →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rule Builder — step 3 in triggered mode, step 2 in adhoc mode */}
          {((pathMode === 'triggered' && step === 3) || (pathMode === 'adhoc' && step === 2)) && createdSurveyId && (
            <RuleBuilderStep
              surveyType={resolvedSurveyType}
              programId={form.programId}
              surveyId={createdSurveyId}
              getToken={getToken}
              onContinue={handleRulesContinue}
              onSkip={handleSkipRules}
              onBack={() => setStep(pathMode === 'triggered' ? 2 : 1)}
            />
          )}

          {/* Review & Launch — step 4 in triggered mode, step 3 in adhoc mode */}
          {((pathMode === 'triggered' && step === 4) || (pathMode === 'adhoc' && step === 3)) && createdSurveyId && (
            <ReviewLaunchStep
              surveyId={createdSurveyId}
              surveyName={form.name}
              surveyType={resolvedSurveyType}
              triggerData={triggerData}
              rules={rules}
              program={selectedProgram}
              getToken={getToken}
              onLaunch={handleLaunched}
              onBack={() => setStep(pathMode === 'triggered' ? 3 : 2)}
            />
          )}
        </div>
      )}
    </div>
  )
}
