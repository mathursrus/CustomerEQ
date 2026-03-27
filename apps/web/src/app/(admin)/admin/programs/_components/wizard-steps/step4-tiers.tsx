'use client'

import { useEffect, useState } from 'react'
import type { StepProps, Tier } from '../program-wizard'
import { TierModal } from '../modals/tier-modal'

function makeTier(overrides: Partial<Tier> = {}): Tier {
  return {
    id: crypto.randomUUID(),
    name: '',
    icon: '🥉',
    minPoints: '0',
    minSpend: '',
    multiplier: '1.0×',
    benefits: '',
    ...overrides,
  }
}

const DEFAULT_TIERS: Omit<Tier, 'id'>[] = [
  {
    name: 'Bronze',
    icon: '🥉',
    minPoints: '0',
    minSpend: '',
    multiplier: '1.0×',
    benefits: 'Free shipping on orders $50+',
  },
  {
    name: 'Gold',
    icon: '🥇',
    minPoints: '500',
    minSpend: '',
    multiplier: '1.5×',
    benefits: 'Free shipping + 10% off',
  },
]

export function Step4Tiers({
  state,
  dispatch,
  onNext,
  onBack,
  onSaveDraft,
  isViewOnly,
}: StepProps) {
  const isTiered =
    state.programType === 'TIERED' || state.programType === 'HYBRID'

  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Initialize default tiers for tiered programs
  useEffect(() => {
    if (isTiered && state.tiers.length === 0) {
      DEFAULT_TIERS.forEach(t => {
        dispatch({ type: 'ADD_TIER', tier: makeTier(t) })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTiered])

  function openEdit(tier: Tier) {
    setEditingTier(tier)
    setModalOpen(true)
  }

  function openNew() {
    setEditingTier(makeTier())
    setModalOpen(true)
  }

  function handleSaveTier(tier: Tier) {
    const exists = state.tiers.find(t => t.id === tier.id)
    if (exists) {
      dispatch({ type: 'UPDATE_TIER', tier })
    } else {
      dispatch({ type: 'ADD_TIER', tier })
    }
    setModalOpen(false)
    setEditingTier(null)
  }

  function removeTier(id: string) {
    dispatch({ type: 'REMOVE_TIER', id })
  }

  function moveTier(idx: number, dir: -1 | 1) {
    const newTiers = [...state.tiers]
    const target = idx + dir
    if (target < 0 || target >= newTiers.length) return
    ;[newTiers[idx], newTiers[target]] = [newTiers[target], newTiers[idx]]
    dispatch({ type: 'REORDER_TIERS', tiers: newTiers })
  }

  // Not-applicable state
  if (!isTiered) {
    return (
      <div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Tier Configuration
          </h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-3xl mb-3">🏆</div>
            <p className="text-slate-600 font-medium mb-1">
              Tier configuration is only available for Tiered and Hybrid programs.
            </p>
            <p className="text-sm text-slate-400">
              Your selected program type ({state.programType ?? 'None'}) does not
              use tiers. Click Next to continue to Rewards.
            </p>
          </div>
        </div>

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
              Next: Rewards →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Tier Configuration
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Progression: entry tier at top → highest at bottom.{' '}
              <span className="text-slate-400">↓ arrows show direction.</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-0">
          {state.tiers.map((tier, idx) => (
            <div key={tier.id}>
              {/* Tier row */}
              <div className="bg-[#fafbff] border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  {/* Move buttons */}
                  {!isViewOnly && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveTier(idx, -1)}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20 text-xs leading-none"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTier(idx, 1)}
                        disabled={idx === state.tiers.length - 1}
                        className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20 text-xs leading-none"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-2xl">{tier.icon}</span>
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">
                        {tier.name || 'Untitled Tier'}
                      </span>
                      {idx === 0 && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          · entry
                        </span>
                      )}
                      {idx === state.tiers.length - 1 && state.tiers.length > 1 && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          · highest
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Criteria */}
                  <div className="flex-1 text-sm text-slate-500">
                    {tier.minPoints ? `${tier.minPoints}+ pts` : '—'}
                    {tier.benefits && (
                      <span className="ml-2 text-slate-400">
                        · {tier.benefits}
                      </span>
                    )}
                  </div>

                  {/* Multiplier */}
                  <div className="text-sm font-medium text-indigo-600 whitespace-nowrap">
                    {tier.multiplier || '—'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-2">
                    {!isViewOnly && (
                      <button
                        type="button"
                        onClick={() => openEdit(tier)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {!isViewOnly && (
                      <button
                        type="button"
                        onClick={() => removeTier(tier.id)}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-20"
                        aria-label="Remove tier"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow divider between tiers */}
              {idx < state.tiers.length - 1 && (
                <div className="flex justify-center py-1 text-slate-400 text-sm">
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add tier */}
        {!isViewOnly && (
          <button
            type="button"
            onClick={openNew}
            className="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-5 py-4 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            + Add tier
          </button>
        )}
      </div>

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
            Next: Rewards →
          </button>
        </div>
      </div>

      {/* Tier modal */}
      {modalOpen && editingTier && (
        <TierModal
          open={modalOpen}
          initialTier={editingTier}
          onClose={() => { setModalOpen(false); setEditingTier(null) }}
          onSave={handleSaveTier}
        />
      )}
    </div>
  )
}
