'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'
import PlaybookSelector from './PlaybookSelector'

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

const ACTION_TYPES = [
  { value: 'award_points', label: 'Award Points' },
  { value: 'award_reward', label: 'Award Reward' },
  { value: 'send_message', label: 'Send Message' },
  { value: 'spin_wheel', label: 'Spin Wheel' },
  { value: 'scratch_card', label: 'Scratch Card' },
  { value: 'mystery_box', label: 'Mystery Box' },
]

export interface SurveyRuleInput {
  scoreMin: number
  scoreMax: number
  actionType: string
  actionConfig: Record<string, unknown>
  ruleLabel?: string
  reachEstimate?: number | null
}

interface CxPlaybook {
  id: string
  name: string
  surveyType: string
  rules: SurveyRuleInput[]
}

const SCORE_MAX: Record<SurveyType, number> = { NPS: 10, CSAT: 5, CES: 7, CUSTOM: 10 }

function defaultRule(surveyType: SurveyType): SurveyRuleInput {
  if (surveyType === 'NPS') {
    return { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 }, ruleLabel: 'Detractors' }
  }
  return { scoreMin: 1, scoreMax: 3, actionType: 'award_points', actionConfig: { points: 100 } }
}

function hasOverlap(rules: SurveyRuleInput[]): boolean {
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (rules[i].scoreMin <= rules[j].scoreMax && rules[j].scoreMin <= rules[i].scoreMax) {
        return true
      }
    }
  }
  return false
}

interface Props {
  surveyType: SurveyType
  programId: string
  surveyId: string
  getToken: () => Promise<string | null>
  onContinue: (rules: SurveyRuleInput[]) => void
  onSkip: () => void
  onBack?: () => void
}

export default function RuleBuilderStep({ surveyType, programId, surveyId: _surveyId, getToken, onContinue, onSkip, onBack }: Props) {
  const [rules, setRules] = useState<SurveyRuleInput[]>([defaultRule(surveyType)])
  const [playbooks, setPlaybooks] = useState<CxPlaybook[]>([])
  const [playbookName, setPlaybookName] = useState('')
  const [savingPlaybook, setSavingPlaybook] = useState(false)
  const [savePlaybookError, setSavePlaybookError] = useState<string | null>(null)
  const overlap = hasOverlap(rules)
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    async function fetchPlaybooks() {
      try {
        const token = await getAuthToken(getToken)
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/cx-playbooks?surveyType=${surveyType}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setPlaybooks(data.data ?? [])
        }
      } catch {
        // silent — playbooks are optional
      }
    }
    fetchPlaybooks()
  }, [surveyType, getToken])

  const fetchReachEstimate = useCallback(async (ruleIndex: number, scoreMin: number, scoreMax: number) => {
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const params = new URLSearchParams({ programId, scoreMin: String(scoreMin), scoreMax: String(scoreMax) })
      const res = await fetch(`${API_URL}/v1/analytics/reach-estimate?${params}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setRules((prev) => prev.map((r, i) => i === ruleIndex ? { ...r, reachEstimate: data.estimatedCount ?? null } : r))
      }
    } catch {
      // silent
    }
  }, [programId, getToken])

  function updateRule(index: number, patch: Partial<SurveyRuleInput>) {
    setRules((prev) => {
      const updated = prev.map((r, i) => i === index ? { ...r, ...patch } : r)
      // Debounce reach estimate fetch on score range change
      if ((patch.scoreMin !== undefined || patch.scoreMax !== undefined)) {
        clearTimeout(debounceTimers.current[index])
        debounceTimers.current[index] = setTimeout(() => {
          fetchReachEstimate(index, updated[index].scoreMin, updated[index].scoreMax)
        }, 500)
      }
      return updated
    })
  }

  function addRule() {
    setRules((prev) => [...prev, defaultRule(surveyType)])
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  async function savePlaybook() {
    if (!playbookName.trim()) return
    setSavingPlaybook(true)
    setSavePlaybookError(null)
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/cx-playbooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: playbookName.trim(), surveyType, rules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `Failed with status ${res.status}`)
      setPlaybooks((prev) => [...prev, data])
      setPlaybookName('')
    } catch (err: unknown) {
      setSavePlaybookError(err instanceof Error ? err.message : 'Failed to save playbook')
    } finally {
      setSavingPlaybook(false)
    }
  }

  const maxScore = SCORE_MAX[surveyType]

  return (
    <div data-testid="rule-builder-step">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">What happens next?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define rules that automatically trigger loyalty actions when responses arrive.
        </p>
      </div>

      {/* Playbook toolbar */}
      <div className="mb-5 flex items-center justify-between">
        <PlaybookSelector
          playbooks={playbooks}
          onLoad={(loadedRules) => setRules(loadedRules)}
        />
        <button
          type="button"
          onClick={addRule}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          data-testid="add-rule-btn"
        >
          + Add rule
        </button>
      </div>

      {/* Overlap error */}
      {overlap && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="overlap-error">
          Score ranges overlap between rules. Please adjust the ranges so they don&apos;t overlap.
        </div>
      )}

      {/* Rule rows */}
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid={`rule-row-${index}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Score Range (0–{maxScore})</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      value={rule.scoreMin}
                      onChange={(e) => updateRule(index, { scoreMin: Number(e.target.value) })}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      data-testid={`rule-score-min-${index}`}
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      value={rule.scoreMax}
                      onChange={(e) => updateRule(index, { scoreMax: Number(e.target.value) })}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      data-testid={`rule-score-max-${index}`}
                    />
                  </div>
                  {rule.reachEstimate !== undefined && rule.reachEstimate !== null && (
                    <span className="mt-1 block text-xs text-indigo-600 font-medium" data-testid={`reach-badge-${index}`}>
                      ~{rule.reachEstimate} members
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
                  <select
                    value={rule.actionType}
                    onChange={(e) => updateRule(index, { actionType: e.target.value, actionConfig: {} })}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid={`rule-action-type-${index}`}
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action config — points only for award_points */}
              {rule.actionType === 'award_points' && (
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Points</label>
                  <input
                    type="number"
                    min={1}
                    value={(rule.actionConfig.points as number) ?? ''}
                    onChange={(e) => updateRule(index, { actionConfig: { points: Number(e.target.value) } })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid={`rule-points-${index}`}
                  />
                </div>
              )}

              <div className="w-32">
                <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={rule.ruleLabel ?? ''}
                  onChange={(e) => updateRule(index, { ruleLabel: e.target.value || undefined })}
                  placeholder="e.g. Detractors"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid={`rule-label-${index}`}
                />
              </div>

              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="mt-5 text-gray-400 hover:text-red-500 text-sm"
                  data-testid={`remove-rule-${index}`}
                  aria-label="Remove rule"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save as Playbook */}
      <div className="mt-5 border-t border-gray-100 pt-5">
        <p className="text-xs font-medium text-gray-600 mb-2">Save rules as a reusable playbook</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Playbook name"
            value={playbookName}
            onChange={(e) => setPlaybookName(e.target.value)}
            className="flex-1 max-w-xs rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="playbook-name-input"
          />
          <button
            type="button"
            onClick={savePlaybook}
            disabled={savingPlaybook || !playbookName.trim()}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            data-testid="save-playbook-btn"
          >
            {savingPlaybook ? 'Saving…' : 'Save as Playbook'}
          </button>
        </div>
        {savePlaybookError && (
          <p className="mt-1 text-xs text-red-600" data-testid="save-playbook-error">{savePlaybookError}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              data-testid="rules-back-btn"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700"
            data-testid="skip-rules-btn"
          >
            Skip — launch without rules
          </button>
        </div>
        <button
          type="button"
          onClick={() => onContinue(rules)}
          disabled={overlap}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="rules-continue-btn"
        >
          Continue: Review &amp; Launch →
        </button>
      </div>
    </div>
  )
}
