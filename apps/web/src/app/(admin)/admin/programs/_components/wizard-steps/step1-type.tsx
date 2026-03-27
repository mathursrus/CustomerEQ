'use client'

import Link from 'next/link'
import type { StepProps, ProgramType } from '../program-wizard'

const PROGRAM_TYPES: {
  type: ProgramType
  icon: string
  name: string
  description: string
}[] = [
  {
    type: 'POINTS',
    icon: '⭐',
    name: 'Points',
    description:
      'Members earn points for actions and redeem them for rewards. Most common program type.',
  },
  {
    type: 'TIERED',
    icon: '🏆',
    name: 'Tiered',
    description:
      'Members progress through tiers (e.g., Bronze → Gold) unlocking better benefits.',
  },
  {
    type: 'CASHBACK',
    icon: '💵',
    name: 'Cashback',
    description:
      'Customers earn a percentage back on purchases as store credit or statement credit.',
  },
  {
    type: 'HYBRID',
    icon: '🔀',
    name: 'Hybrid',
    description:
      'Combine points, tiers, and cashback into a single unified program.',
  },
]

export function Step1Type({ state, dispatch, onNext, isViewOnly }: StepProps) {
  function selectType(type: ProgramType) {
    if (isViewOnly) return
    dispatch({ type: 'SET_TYPE', programType: type })
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Select Program Type
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Choose the loyalty model that best fits your business goals.
        </p>

        <div
          className={`grid grid-cols-2 gap-4 ${isViewOnly ? 'pointer-events-none opacity-60' : ''}`}
        >
          {PROGRAM_TYPES.map(({ type, icon, name, description }) => {
            const selected = state.programType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className={`text-left rounded-xl p-5 transition-colors ${
                  selected
                    ? 'border-2 border-indigo-600 bg-indigo-50'
                    : 'border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-3xl mb-3">{icon}</div>
                <div className="font-semibold text-slate-900 mb-1">{name}</div>
                <div className="text-sm text-slate-500">{description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-gray-50 mt-6 pt-4 pb-2 border-t border-slate-200 flex items-center justify-between">
        <Link
          href="/admin/programs"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors"
        >
          ← Back to Programs
        </Link>
        <button
          type="button"
          onClick={onNext}
          disabled={!state.programType}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next: Basic Info →
        </button>
      </div>
    </div>
  )
}
