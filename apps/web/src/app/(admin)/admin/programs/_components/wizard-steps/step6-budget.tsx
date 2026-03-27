'use client'

import type { StepProps } from '../program-wizard'

const ALERT_THRESHOLD_OPTIONS = [
  { value: '70', label: 'Alert me at 70% consumed' },
  { value: '80', label: 'Alert me at 80% consumed' },
  { value: '90', label: 'Alert me at 90% consumed' },
]

const HALT_BEHAVIOR_OPTIONS = [
  {
    value: 'PAUSE_RULES',
    label: 'Pause all rule evaluations (members can still redeem)',
  },
  {
    value: 'PAUSE_PROGRAM',
    label: 'Pause entire program',
  },
]

export function Step6Budget({
  state,
  dispatch,
  onNext,
  onBack,
  onSaveDraft,
  isViewOnly,
}: StepProps) {
  const totalBudgetNum = parseFloat(state.totalBudget) || 0
  const totalBudgetDisplay = totalBudgetNum > 0 ? `$${totalBudgetNum.toLocaleString()}` : '—'

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Budget &amp; Caps
          </h2>
          <p className="text-sm text-slate-500">
            Set spending limits to keep your program financially safe.
          </p>
        </div>

        {/* Total budget + monthly cap */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Total Program Budget (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={state.totalBudget}
                onChange={e =>
                  dispatch({
                    type: 'SET_FIELD',
                    field: 'totalBudget',
                    value: e.target.value,
                  })
                }
                disabled={isViewOnly}
                placeholder="10,000"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Hard cap on total points value issued.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Monthly Rolling Cap (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={state.monthlyCap}
                onChange={e =>
                  dispatch({
                    type: 'SET_FIELD',
                    field: 'monthlyCap',
                    value: e.target.value,
                  })
                }
                disabled={isViewOnly}
                placeholder="1,000"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Resets on the 1st of each month.
            </p>
          </div>
        </div>

        {/* Alert threshold */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Alert Threshold
          </label>
          <select
            value={state.alertThreshold}
            onChange={e =>
              dispatch({
                type: 'SET_FIELD',
                field: 'alertThreshold',
                value: e.target.value,
              })
            }
            disabled={isViewOnly}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
          >
            {ALERT_THRESHOLD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Halt behavior */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            When Budget Cap Is Reached
          </label>
          <select
            value={state.haltBehavior}
            onChange={e =>
              dispatch({
                type: 'SET_FIELD',
                field: 'haltBehavior',
                value: e.target.value,
              })
            }
            disabled={isViewOnly}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
          >
            {HALT_BEHAVIOR_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Budget consumed preview bar */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Budget Consumed
            </span>
            <span className="text-sm text-slate-500">
              $0 / {totalBudgetDisplay} (0%)
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: '0%' }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Budget consumption will appear here once the program is activated.
          </p>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-gray-50 mt-6 pt-4 pb-2 border-t border-slate-200 flex items-center justify-between">
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
            Next: Preview &amp; Activate →
          </button>
        </div>
      </div>
    </div>
  )
}
