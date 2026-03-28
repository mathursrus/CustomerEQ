'use client'

import { useState } from 'react'
import type { StepProps, Reward } from '../program-wizard'
import { RewardModal } from '../modals/reward-modal'
import { ExpireModal } from '../modals/expire-modal'

const REWARD_TYPE_ICONS: Record<string, string> = {
  'Discount Code': '🏷️',
  'Free Product': '🎁',
  'Cashback': '💵',
  'Gift Card': '💳',
  'Experience': '🎟️',
}

function rewardIcon(rewardType: string): string {
  return REWARD_TYPE_ICONS[rewardType] ?? '🎁'
}

export function Step5Rewards({
  state,
  dispatch,
  onNext,
  onBack,
  onSaveDraft,
  isViewOnly,
}: StepProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editReward, setEditReward] = useState<Reward | null>(null)
  const [expireReward, setExpireReward] = useState<Reward | null>(null)
  const [noRewardError, setNoRewardError] = useState(false)

  function handleNext() {
    if (state.rewards.length === 0) {
      setNoRewardError(true)
      return
    }
    setNoRewardError(false)
    onNext()
  }

  function handleSaveReward(reward: Reward) {
    const exists = state.rewards.find(r => r.id === reward.id)
    if (exists) {
      dispatch({ type: 'UPDATE_REWARD', reward })
    } else {
      dispatch({ type: 'ADD_REWARD', reward })
    }
    setAddOpen(false)
    setEditReward(null)
  }

  function handleRetire(reward: Reward) {
    setExpireReward(reward)
  }

  function handleExpireConfirm() {
    // In a real app we'd set a retirement date / status on the reward.
    // For the wizard, we simply remove it from the draft.
    if (expireReward) {
      dispatch({ type: 'REMOVE_REWARD', id: expireReward.id })
    }
    setExpireReward(null)
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Rewards Catalog
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Define what members can redeem their points for.
            </p>
          </div>
          {!isViewOnly && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              + Add Reward
            </button>
          )}
        </div>

        {state.rewards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <div className="text-3xl mb-2">🎁</div>
            <p className="text-sm text-slate-500">
              No rewards yet. Add your first reward to the catalog.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.rewards.map(reward => (
              <div
                key={reward.id}
                className="bg-[#fafbff] border border-slate-200 rounded-xl p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {rewardIcon(reward.rewardType)}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {reward.name}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>
                  {!isViewOnly && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => setEditReward(reward)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRetire(reward)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        🗂️ Retire
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                {reward.description && (
                  <p className="text-sm text-slate-500 mb-2 ml-7">
                    {reward.description}
                  </p>
                )}

                {/* Info row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-7 text-xs text-slate-500">
                  <span>
                    <span className="text-slate-400">Type: </span>
                    {reward.rewardType}
                  </span>
                  <span>
                    <span className="text-slate-400">Cost: </span>
                    {reward.pointsCost
                      ? `${reward.pointsCost} pts`
                      : '—'}
                  </span>
                  <span>
                    <span className="text-slate-400">Stock: </span>
                    {reward.stock === 'LIMITED'
                      ? `${reward.stockQty} remaining`
                      : 'Unlimited'}
                  </span>
                  <span>
                    <span className="text-slate-400">Tiers: </span>
                    {reward.eligibleTiers || 'All Tiers'}
                  </span>
                  <span>
                    <span className="text-slate-400">Availability: </span>
                    {reward.availability === 'DATES'
                      ? `${reward.availFrom} – ${reward.availUntil}`
                      : 'Always'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add reward dashed button */}
        {!isViewOnly && state.rewards.length > 0 && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-5 py-4 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            + Add reward
          </button>
        )}
      </div>

      {noRewardError && (
        <p className="mt-3 text-sm text-red-500">At least one reward is required before advancing.</p>
      )}

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
            Next: Budget →
          </button>
        </div>
      </div>

      {/* Add / Edit modal */}
      <RewardModal
        open={addOpen || editReward !== null}
        initialReward={editReward ?? undefined}
        onClose={() => { setAddOpen(false); setEditReward(null) }}
        onSave={handleSaveReward}
      />

      {/* Expire modal */}
      <ExpireModal
        open={expireReward !== null}
        rewardName={expireReward?.name}
        onClose={() => setExpireReward(null)}
        onConfirm={handleExpireConfirm}
      />
    </div>
  )
}
