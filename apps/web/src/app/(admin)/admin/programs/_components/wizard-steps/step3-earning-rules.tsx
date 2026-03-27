'use client'

import { useEffect } from 'react'
import type { StepProps, EarningRule, Condition } from '../program-wizard'

const TRIGGER_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'review', label: 'Review' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_share', label: 'Social Share' },
  { value: 'survey_completion', label: 'Survey Completion' },
  { value: 'enrollment', label: 'Enrollment' },
]

const FIELD_OPTIONS = [
  { value: 'product_category', label: 'Product Category' },
  { value: 'channel', label: 'Channel' },
  { value: 'spend_amount', label: 'Spend Amount' },
  { value: 'time_of_day', label: 'Time of Day' },
]

const OP_OPTIONS = [
  { value: '=', label: '=' },
  { value: '≠', label: '≠' },
  { value: '≥', label: '≥' },
  { value: '≤', label: '≤' },
]

function makeCondition(): Condition {
  return { id: crypto.randomUUID(), field: 'spend_amount', op: '≥', value: '' }
}

function makeRule(priority: number): EarningRule {
  return {
    id: crypto.randomUUID(),
    trigger: 'purchase',
    conditions: [{ id: crypto.randomUUID(), field: 'spend_amount', op: '≥', value: '$1' }],
    conditionLogic: 'AND',
    action: 'AWARD_POINTS',
    actionValue: '1',
    budgetCapPoints: '',
    priority,
    stackable: false,
  }
}

export function Step3EarningRules({
  state,
  dispatch,
  onNext,
  onBack,
  onSaveDraft,
  isViewOnly,
}: StepProps) {
  // Pre-fill default rule if empty
  useEffect(() => {
    if (state.earningRules.length === 0) {
      dispatch({ type: 'ADD_RULE', rule: makeRule(1) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addRule() {
    dispatch({
      type: 'ADD_RULE',
      rule: makeRule(state.earningRules.length + 1),
    })
  }

  function updateRule(rule: EarningRule) {
    dispatch({ type: 'UPDATE_RULE', rule })
  }

  function removeRule(id: string) {
    dispatch({ type: 'REMOVE_RULE', id })
  }

  function addCondition(rule: EarningRule) {
    updateRule({ ...rule, conditions: [...rule.conditions, makeCondition()] })
  }

  function updateCondition(rule: EarningRule, cond: Condition) {
    updateRule({
      ...rule,
      conditions: rule.conditions.map(c => (c.id === cond.id ? cond : c)),
    })
  }

  function removeCondition(rule: EarningRule, condId: string) {
    updateRule({
      ...rule,
      conditions: rule.conditions.filter(c => c.id !== condId),
    })
  }

  const nextLabel =
    state.programType === 'TIERED' || state.programType === 'HYBRID'
      ? 'Next: Tier Config →'
      : 'Next: Rewards →'

  return (
    <div>
      <div className="space-y-4">
        {state.earningRules.map((rule, ruleIdx) => (
          <div
            key={rule.id}
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            {/* Rule header */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                Rule {ruleIdx + 1} · Priority {rule.priority}
              </span>
              {rule.stackable && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Stackable
                </span>
              )}
              <div className="flex-1" />
              {/* Trigger */}
              <select
                value={rule.trigger}
                onChange={e => updateRule({ ...rule, trigger: e.target.value })}
                disabled={isViewOnly}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {TRIGGER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                  aria-label="Remove rule"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Conditions */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Conditions
                </span>
                {rule.conditions.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateRule({ ...rule, conditionLogic: 'AND' })
                      }
                      disabled={isViewOnly}
                      className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                        rule.conditionLogic === 'AND'
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateRule({ ...rule, conditionLogic: 'OR' })
                      }
                      disabled={isViewOnly}
                      className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                        rule.conditionLogic === 'OR'
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {rule.conditions.map(cond => (
                  <div key={cond.id} className="flex items-center gap-2">
                    <select
                      value={cond.field}
                      onChange={e =>
                        updateCondition(rule, { ...cond, field: e.target.value })
                      }
                      disabled={isViewOnly}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.op}
                      onChange={e =>
                        updateCondition(rule, { ...cond, op: e.target.value })
                      }
                      disabled={isViewOnly}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {OP_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={cond.value}
                      onChange={e =>
                        updateCondition(rule, { ...cond, value: e.target.value })
                      }
                      disabled={isViewOnly}
                      placeholder="value"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {!isViewOnly && rule.conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(rule, cond.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Remove condition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isViewOnly && (
                <button
                  type="button"
                  onClick={() => addCondition(rule)}
                  className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  + Add condition
                </button>
              )}
            </div>

            {/* Action row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Action
                </label>
                <select
                  value={rule.action}
                  onChange={e =>
                    updateRule({
                      ...rule,
                      action: e.target.value as EarningRule['action'],
                    })
                  }
                  disabled={isViewOnly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="AWARD_POINTS">Award Points</option>
                  <option value="MULTIPLIER">Multiplier on base</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {rule.action === 'MULTIPLIER' ? 'Multiplier (×)' : 'Points per $1'}
                </label>
                <input
                  type="text"
                  value={rule.actionValue}
                  onChange={e =>
                    updateRule({ ...rule, actionValue: e.target.value })
                  }
                  disabled={isViewOnly}
                  placeholder={rule.action === 'MULTIPLIER' ? '2.0' : '1'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Budget Cap (pts)
                </label>
                <input
                  type="text"
                  value={rule.budgetCapPoints}
                  onChange={e =>
                    updateRule({ ...rule, budgetCapPoints: e.target.value })
                  }
                  disabled={isViewOnly}
                  placeholder="No cap"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Stackable checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rule.stackable}
                onChange={e =>
                  updateRule({ ...rule, stackable: e.target.checked })
                }
                disabled={isViewOnly}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">
                Stackable{' '}
                <span className="text-slate-400 text-xs">
                  — this rule combines with other active rules
                </span>
              </span>
            </label>
          </div>
        ))}
      </div>

      {/* Add rule button */}
      {!isViewOnly && (
        <button
          type="button"
          onClick={addRule}
          className="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-5 py-4 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          + Add rule
        </button>
      )}

      {/* Bottom nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isViewOnly}
            className="rounded-lg border border-indigo-600 px-5 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
