'use client'

import { useState } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'
import type { SurveyRuleInput } from './RuleBuilderStep'

interface TriggerData {
  category: string
  key: string
  surveyTypeOverride?: string
}

interface Program {
  id: string
  name: string
  budgetUsdCents?: number | null
  monthlyBudgetUsdCents?: number | null
}

interface Props {
  surveyId: string
  surveyName: string
  surveyType: string
  triggerData: TriggerData | null
  rules: SurveyRuleInput[]
  program: Program | null
  getToken: () => Promise<string | null>
  onLaunch: () => void
  onBack: () => void
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  award_points: 'Award Points',
  award_reward: 'Award Reward',
  send_message: 'Send Message',
  spin_wheel: 'Spin Wheel',
  scratch_card: 'Scratch Card',
  mystery_box: 'Mystery Box',
}

export default function ReviewLaunchStep({
  surveyId,
  surveyName,
  surveyType,
  triggerData,
  rules,
  program,
  getToken,
  onLaunch,
  onBack,
}: Props) {
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estimated point cost for award_points rules
  const estimatedPointCost = rules.reduce((sum, rule) => {
    if (rule.actionType === 'award_points') {
      const pts = (rule.actionConfig.points as number) ?? 0
      const reach = rule.reachEstimate ?? 0
      return sum + pts * reach
    }
    return sum
  }, 0)

  const budgetCapPoints = program?.budgetUsdCents ? program.budgetUsdCents : null
  const overBudget = budgetCapPoints !== null && estimatedPointCost > budgetCapPoints

  async function handleLaunch() {
    setLaunching(true)
    setError(null)
    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/launch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `Failed with status ${res.status}`)
      onLaunch()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch survey')
      setLaunching(false)
    }
  }

  return (
    <div data-testid="review-launch-step">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Review &amp; Launch</h2>
        <p className="mt-1 text-sm text-gray-500">Review your survey before making it live.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" data-testid="launch-error">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Survey identity */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="review-survey-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Survey</p>
          <p className="text-sm font-semibold text-gray-900">{surveyName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{surveyType}</p>
        </div>

        {/* Trigger */}
        {triggerData && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="review-trigger-card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Trigger</p>
            <p className="text-sm text-gray-700">{triggerData.category} / {triggerData.key}</p>
          </div>
        )}

        {/* Rules */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="review-rules-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Response Rules</p>
          {rules.length === 0 ? (
            <p className="text-sm text-gray-400">No rules — survey will launch without automated actions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-1.5 text-left font-medium">Score Range</th>
                  <th className="pb-1.5 text-left font-medium">Action</th>
                  <th className="pb-1.5 text-right font-medium">Est. Reach</th>
                  <th className="pb-1.5 text-right font-medium">Points Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule, i) => {
                  const pts = rule.actionType === 'award_points' ? (rule.actionConfig.points as number) ?? 0 : 0
                  const reach = rule.reachEstimate ?? 0
                  return (
                    <tr key={i} data-testid={`review-rule-row-${i}`}>
                      <td className="py-2">{rule.ruleLabel ? `${rule.ruleLabel} (${rule.scoreMin}–${rule.scoreMax})` : `${rule.scoreMin}–${rule.scoreMax}`}</td>
                      <td className="py-2 text-gray-600">{ACTION_TYPE_LABELS[rule.actionType] ?? rule.actionType}</td>
                      <td className="py-2 text-right text-gray-600">{reach > 0 ? `~${reach}` : '—'}</td>
                      <td className="py-2 text-right text-gray-600">{rule.actionType === 'award_points' ? `${(pts * reach).toLocaleString()} pts` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Budget summary */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="review-budget-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Estimated Budget</p>
          <p className="text-sm font-semibold text-gray-900">
            {estimatedPointCost.toLocaleString()} pts total
          </p>
          {overBudget && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2" data-testid="budget-warning">
              ⚠ Estimated cost exceeds your program budget cap. Consider reducing point amounts or reach.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-gray-600 hover:text-gray-800"
          data-testid="back-btn"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          data-testid="launch-btn"
        >
          {launching ? 'Launching…' : 'Launch Survey'}
        </button>
      </div>
    </div>
  )
}
