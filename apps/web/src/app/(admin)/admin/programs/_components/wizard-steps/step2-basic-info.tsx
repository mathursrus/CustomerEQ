'use client'

import { useState } from 'react'
import type { StepProps } from '../program-wizard'

const CURRENCY_OPTIONS = [
  'Stars',
  'Points',
  'Coins',
  'Miles',
  'Credits',
  'Sparks',
  'Cash Back',
  'Other (custom)…',
]

export function Step2BasicInfo({
  state,
  dispatch,
  onNext,
  onBack,
  onSaveDraft,
  isViewOnly,
}: StepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const today = new Date().toISOString().split('T')[0]
  const startInPast = state.startDate && state.startDate < today
  const endBeforeStart =
    state.startDate && state.endDate && state.endDate < state.startDate

  function handleNext() {
    const newErrors: Record<string, string> = {}
    if (!state.name.trim()) newErrors.name = 'Program name is required.'
    if (!state.startDate) newErrors.startDate = 'Start date is required.'
    if (endBeforeStart) newErrors.endDate = 'End date cannot be before start date.'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    onNext()
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Basic Information
          </h2>
          <p className="text-sm text-slate-500">
            Set the program name, description, dates, and point currency.
          </p>
        </div>

        {/* Program Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Program Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.name}
            onChange={e =>
              dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })
            }
            disabled={isViewOnly}
            placeholder="e.g. Summer Rewards 2025"
            className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Member-Facing Description
          </label>
          <textarea
            value={state.description}
            onChange={e =>
              dispatch({
                type: 'SET_FIELD',
                field: 'description',
                value: e.target.value,
              })
            }
            disabled={isViewOnly}
            placeholder="Describe the program to your members…"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60 resize-none"
          />
        </div>

        {/* Start Date + End Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={state.startDate}
              onChange={e => {
                dispatch({ type: 'SET_FIELD', field: 'startDate', value: e.target.value })
                setErrors(prev => ({ ...prev, startDate: '' }))
              }}
              disabled={isViewOnly}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60 ${errors.startDate ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
            {!errors.startDate && startInPast && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠️ Start date is in the past. The program will be active immediately upon activation.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={state.endDate}
              onChange={e => {
                dispatch({ type: 'SET_FIELD', field: 'endDate', value: e.target.value })
                setErrors(prev => ({ ...prev, endDate: '' }))
              }}
              disabled={isViewOnly}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60 ${errors.endDate ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.endDate
              ? <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>
              : <p className="mt-1 text-xs text-slate-500">Leave blank for ongoing</p>
            }
          </div>
        </div>

        {/* Currency Symbol */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Currency Symbol
          </label>
          <select
            value={state.currencyName}
            onChange={e =>
              dispatch({
                type: 'SET_FIELD',
                field: 'currencyName',
                value: e.target.value,
              })
            }
            disabled={isViewOnly}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
          >
            {CURRENCY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Shown to members as their balance unit (e.g. &quot;You have 840 Stars&quot;).
          </p>
        </div>

        {/* Custom currency input */}
        {state.currencyName === 'Other (custom)…' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Custom Currency Name
            </label>
            <input
              type="text"
              value={state.currencyCustom}
              onChange={e =>
                dispatch({
                  type: 'SET_FIELD',
                  field: 'currencyCustom',
                  value: e.target.value,
                })
              }
              disabled={isViewOnly}
              placeholder="e.g. Gems, Tokens, Petals…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
            />
          </div>
        )}
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
            onClick={handleNext}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Next: Earning Rules →
          </button>
        </div>
      </div>
    </div>
  )
}
