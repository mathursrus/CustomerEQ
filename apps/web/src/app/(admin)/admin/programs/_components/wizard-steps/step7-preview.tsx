'use client'

import { useState } from 'react'
import type { StepProps } from '../program-wizard'

interface Step7Props extends StepProps {
  onActivate: () => void
}

const CATEGORY_OPTIONS = ['Electronics', 'Apparel', 'Home & Garden']
const CHANNEL_OPTIONS = ['web', 'mobile app', 'in-store']

function ChecklistItem({
  ok,
  label,
}: {
  ok: boolean
  label: string
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={ok ? 'text-green-500' : 'text-amber-500'}>
        {ok ? '✅' : '⚠️'}
      </span>
      <span className={ok ? 'text-slate-700' : 'text-amber-700'}>{label}</span>
    </li>
  )
}

export function Step7Preview({
  state,
  dispatch,
  onBack,
  onSaveDraft,
  onActivate,
  isViewOnly,
}: Step7Props) {
  const [simAmount, setSimAmount] = useState('$100')
  const [simCategory, setSimCategory] = useState('Electronics')
  const [simChannel, setSimChannel] = useState('web')

  const isTiered =
    state.programType === 'TIERED' || state.programType === 'HYBRID'

  const currencyLabel =
    state.currencyName === 'Other (custom)…'
      ? state.currencyCustom || 'Points'
      : state.currencyName || 'Points'

  function runSimulation() {
    const amountStr = simAmount.replace(/[^0-9.]/g, '')
    const amount = parseFloat(amountStr) || 0
    const isDouble = simCategory === 'Electronics' && simChannel === 'web'
    const earned = isDouble ? amount * 2 : amount
    const newBalance = state.simBalance + earned
    const resultText = isDouble
      ? `Rule fired: Rule 1 (Electronics + web → 2× multiplier)\nMember earns: ${earned} ${currencyLabel} (${amount} base × 2× multiplier)\nNew balance: ${newBalance} ${currencyLabel}`
      : `Rule fired: Rule 1 (Base award → 1 pt per $1)\nMember earns: ${earned} ${currencyLabel}\nNew balance: ${newBalance} ${currencyLabel}`
    dispatch({ type: 'SET_SIM', balance: newBalance, result: resultText })
  }

  // Checklist items
  const checks = [
    { ok: !!state.programType, label: 'Program type selected' },
    { ok: !!state.name.trim(), label: 'Program name set' },
    { ok: !!state.startDate, label: 'Start date configured' },
    {
      ok: state.earningRules.length > 0,
      label: `${state.earningRules.length} earning rule${state.earningRules.length !== 1 ? 's' : ''} configured`,
    },
    ...(isTiered
      ? [
          {
            ok: state.tiers.length > 0,
            label: `${state.tiers.length} tier${state.tiers.length !== 1 ? 's' : ''} configured`,
          },
        ]
      : []),
    {
      ok: state.rewards.length > 0,
      label: `${state.rewards.length} reward${state.rewards.length !== 1 ? 's' : ''} in catalog`,
    },
    { ok: !!state.totalBudget, label: 'Budget cap set' },
  ]

  const allGood = checks.every(c => c.ok)

  // Tier progress (mock: 35% toward next tier)
  const firstTier = state.tiers[0]
  const secondTier = state.tiers[1]
  const progressPct = 35

  return (
    <div className="flex gap-6 items-start">
      {/* LEFT column */}
      <div className="flex-1 space-y-4">
        {/* Checklist card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Pre-Activation Checklist
          </h2>
          <ul className="space-y-2.5">
            {checks.map((item, i) => (
              <ChecklistItem key={i} ok={item.ok} label={item.label} />
            ))}
          </ul>
          {allGood && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✅ Everything looks good! Your program is ready to activate.
            </div>
          )}
          {!allGood && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              ⚠️ Complete the items above before activating.
            </div>
          )}
        </div>

        {/* Simulation card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            🧪 Simulate Member Action
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Purchase Amount
              </label>
              <input
                type="text"
                value={simAmount}
                onChange={e => setSimAmount(e.target.value)}
                disabled={isViewOnly}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Product Category
              </label>
              <select
                value={simCategory}
                onChange={e => setSimCategory(e.target.value)}
                disabled={isViewOnly}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Channel
              </label>
              <select
                value={simChannel}
                onChange={e => setSimChannel(e.target.value)}
                disabled={isViewOnly}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {CHANNEL_OPTIONS.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={runSimulation}
            disabled={isViewOnly}
            className="rounded-lg border border-indigo-600 px-5 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Run Simulation
          </button>

          {/* Result panel */}
          {state.simResult && (
            <div className="mt-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-4">
              <div className="text-sm font-semibold text-green-800 mb-2">
                ✅ Simulation Result
              </div>
              <pre className="text-sm text-green-700 whitespace-pre-wrap font-sans">
                {state.simResult}
              </pre>
            </div>
          )}
        </div>

        {/* Button row */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isViewOnly}
            className="rounded-lg border border-indigo-600 px-5 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save as Draft
          </button>
          {!isViewOnly && (
            <button
              type="button"
              onClick={onActivate}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              🚀 Activate Program
            </button>
          )}
        </div>
      </div>

      {/* RIGHT column — phone preview */}
      <div className="flex-shrink-0">
        <p className="text-xs font-medium text-slate-500 mb-3 text-center">
          Member experience preview
        </p>
        <div
          className="w-64 rounded-[36px] shadow-xl overflow-hidden"
          style={{ border: '8px solid #1a1a1a' }}
        >
          <div className="bg-white p-5 min-h-[480px]">
            {/* Logo */}
            <div className="text-center mb-4">
              <div className="text-base font-bold text-indigo-600">
                {state.name || 'Loyalty Program'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Powered by CustomerEQ
              </div>
            </div>

            {/* Member badge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                🥈 Silver Member
              </span>
            </div>

            {/* Balance */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-indigo-600">
                {state.simBalance.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {currencyLabel} balance
              </div>
            </div>

            {/* Tier progress bar */}
            <div className="mb-4">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-500">
                  {firstTier?.name || 'Bronze'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {secondTier?.name || 'Gold'}
                </span>
              </div>
            </div>

            {/* Available rewards */}
            {state.rewards.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Available Rewards
                </div>
                <div className="space-y-1.5">
                  {state.rewards.slice(0, 3).map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2"
                    >
                      <span className="text-xs text-slate-700 truncate">
                        {r.name}
                      </span>
                      <span className="text-[10px] font-medium text-indigo-600 ml-2 whitespace-nowrap">
                        {r.pointsCost} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.rewards.length === 0 && (
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-xs text-slate-400">
                  No rewards added yet
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
