'use client'

import { useState, useEffect } from 'react'
import { API_URL } from '@/lib/config'
import { getTriggerRecommendation } from '@/utils/triggerRecommendation'

interface Program {
  id: string
  name: string
}

interface SubTrigger {
  key: string
  label: string
  icon: string
}

interface ReachEstimate {
  estimatedCount: number | null
  reason?: string
  channels: { email: number; inApp: number; sms: number } | null
  windowDays: number
}

interface TriggerStepProps {
  programs: Program[]
  getToken: () => Promise<string | null>
  onContinue: (data: { category: string; key: string; surveyTypeOverride?: string }) => void
}

const CATEGORY_CARDS = [
  {
    id: 'loyalty',
    label: 'Loyalty Moment',
    description: 'Trigger after a meaningful loyalty milestone',
    icon: '🏆',
    testId: 'trigger-category-loyalty',
  },
  {
    id: 'cx_risk',
    label: 'CX Risk',
    description: 'Detect and respond to customer experience issues',
    icon: '⚠️',
    testId: 'trigger-category-cx_risk',
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    description: 'Send on a regular cadence regardless of events',
    icon: '📅',
    testId: 'trigger-category-scheduled',
  },
] as const

type Category = 'loyalty' | 'cx_risk' | 'scheduled'

const STATIC_SUB_TRIGGERS: Record<string, SubTrigger[]> = {
  cx_risk: [
    { key: 'after_support', label: 'After Support', icon: '🎧' },
    { key: 'nps_drop', label: 'NPS Drop', icon: '📉' },
    { key: 'inactive_30d', label: '30d Inactive', icon: '💤' },
  ],
  scheduled: [
    { key: 'quarterly_pulse', label: 'Quarterly Pulse', icon: '📅' },
    { key: 'monthly_csat', label: 'Monthly CSAT', icon: '📊' },
    { key: 'annual_program', label: 'Annual Program', icon: '🗓️' },
  ],
}

const SURVEY_TYPES = ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const
type SurveyType = (typeof SURVEY_TYPES)[number]

export default function TriggerStep({ programs, getToken, onContinue }: TriggerStepProps) {
  const [category, setCategory] = useState<Category | null>(null)
  const [subTriggers, setSubTriggers] = useState<SubTrigger[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [reachEstimate, setReachEstimate] = useState<ReachEstimate | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideType, setOverrideType] = useState<SurveyType | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [loadingSubTriggers, setLoadingSubTriggers] = useState(false)

  const defaultProgramId = programs[0]?.id

  // Load sub-triggers when loyalty category is selected
  useEffect(() => {
    if (category !== 'loyalty' || !defaultProgramId) {
      setSubTriggers(category && category !== 'loyalty' ? STATIC_SUB_TRIGGERS[category] ?? [] : [])
      return
    }

    setLoadingSubTriggers(true)
    ;(async () => {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/programs/${defaultProgramId}/trigger-options`, { headers })
        if (res.ok) {
          const data = await res.json()
          setSubTriggers(data.loyaltyMoments ?? [])
        }
      } catch {
        // silently fall back to empty — UI still functional
      } finally {
        setLoadingSubTriggers(false)
      }
    })()
  }, [category, defaultProgramId, getToken])

  // Fetch reach estimate whenever a key is selected
  useEffect(() => {
    if (!selectedKey || !defaultProgramId) {
      setReachEstimate(null)
      return
    }

    ;(async () => {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const url = `${API_URL}/v1/analytics/reach-estimate?triggerKey=${encodeURIComponent(selectedKey)}&programId=${encodeURIComponent(defaultProgramId)}`
        const res = await fetch(url, { headers })
        if (res.ok) {
          setReachEstimate(await res.json())
        }
      } catch {
        // leave reach estimate null — graceful degradation
      }
    })()
  }, [selectedKey, defaultProgramId, getToken])

  function handleCategoryClick(cat: Category) {
    setCategory(cat)
    setSelectedKey(null)
    setReachEstimate(null)
    setOverrideOpen(false)
    setOverrideType(null)
    setValidationError(null)
  }

  function handleKeyClick(key: string) {
    setSelectedKey(key)
    setOverrideOpen(false)
    setOverrideType(null)
  }

  function handleContinue() {
    if (!category) {
      setValidationError('Please select a trigger category to continue.')
      return
    }
    if (!selectedKey) {
      setValidationError('Please select a specific trigger to continue.')
      return
    }
    setValidationError(null)
    onContinue({
      category,
      key: selectedKey,
      surveyTypeOverride: overrideType ?? undefined,
    })
  }

  const recommendation = selectedKey ? getTriggerRecommendation(selectedKey) : null
  const effectiveType = overrideType ?? recommendation?.type ?? null

  return (
    <div data-testid="trigger-step" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">When should this survey trigger?</h2>
        <p className="mt-1 text-sm text-gray-500">Choose the moment that will prompt members to complete this survey.</p>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-3 gap-4">
        {CATEGORY_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            data-testid={card.testId}
            onClick={() => handleCategoryClick(card.id)}
            className={`rounded-xl border-2 p-4 text-left transition-colors ${
              category === card.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-sm font-semibold text-gray-900">{card.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Sub-trigger pills */}
      {category && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Select a specific trigger</p>
          {loadingSubTriggers ? (
            <p className="text-sm text-gray-400">Loading triggers…</p>
          ) : subTriggers.length === 0 ? (
            <p className="text-sm text-gray-400">No triggers configured for this program yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subTriggers.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  data-testid={`sub-trigger-${st.key}`}
                  onClick={() => handleKeyClick(st.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedKey === st.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{st.icon}</span>
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendation box */}
      {recommendation && selectedKey && (
        <div data-testid="recommendation-box" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Recommended survey type</p>
              <p data-testid="recommendation-type" className="text-lg font-bold text-indigo-700">
                {effectiveType}
              </p>
              {!overrideOpen && (
                <p data-testid="recommendation-rationale" className="mt-1 text-sm text-indigo-600">
                  {recommendation.rationale}
                </p>
              )}
              {overrideOpen && (
                <p data-testid="override-rationale-note" className="mt-1 text-xs text-indigo-500 italic">
                  Original rationale: {recommendation.rationale}
                </p>
              )}
            </div>
            {/* Reach badge */}
            {reachEstimate && (
              <div
                data-testid="reach-badge"
                className="flex-shrink-0 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-center"
              >
                <p className="text-lg font-bold text-indigo-700">
                  {reachEstimate.estimatedCount !== null ? reachEstimate.estimatedCount : 'unavailable'}
                </p>
                <p className="text-xs text-indigo-500">est. reach / {reachEstimate.windowDays}d</p>
              </div>
            )}
          </div>

          {/* Override link */}
          {!overrideOpen && (
            <button
              type="button"
              data-testid="override-link"
              onClick={() => setOverrideOpen(true)}
              className="mt-3 text-xs text-indigo-500 underline hover:text-indigo-700"
            >
              Choose a different survey type
            </button>
          )}

          {/* Override picker */}
          {overrideOpen && (
            <div data-testid="override-picker" className="mt-3 flex flex-wrap gap-2">
              {SURVEY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOverrideType(t === recommendation.type && !overrideType ? null : t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    effectiveType === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <p data-testid="trigger-validation-error" className="text-sm text-red-600">
          {validationError}
        </p>
      )}

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="trigger-continue-btn"
          onClick={handleContinue}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
