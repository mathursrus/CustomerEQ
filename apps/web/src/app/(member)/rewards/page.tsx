'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface Reward {
  id: string
  name: string
  description?: string
  pointsCost: number
  stock: number | null
}

interface RedemptionResult {
  rewardName: string
  pointsCost: number
}

export default function RewardsPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null)
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    async function fetchData() {
      const token = await getToken()
      const [rewardsRes, balanceRes] = await Promise.all([
        fetch(`${API_URL}/v1/rewards`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/v1/members/me/balance`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (rewardsRes.ok) {
        const d = await rewardsRes.json()
        setRewards(d.rewards ?? d ?? [])
      }
      if (balanceRes.ok) {
        const d = await balanceRes.json()
        setBalance(d.pointsBalance ?? d.balance ?? 0)
      }
      setLoading(false)
    }
    fetchData()
  }, [getToken, user?.id])

  async function handleRedeem(reward: Reward) {
    setRedeeming(reward.id)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/redemptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward.id }),
      })
      if (res.ok) {
        setBalance((b) => b - reward.pointsCost)
        setConfirmReward(null)
        setRedemptionResult({ rewardName: reward.name, pointsCost: reward.pointsCost })
      } else {
        const data = await res.json().catch(() => ({}))
        const msg: string = data?.message ?? data?.error ?? ''
        setError(
          res.status === 422 || msg.toLowerCase().includes('insufficient')
            ? 'Insufficient points balance'
            : msg || 'Redemption failed. Please try again.',
        )
        setConfirmReward(null)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  )

  // Sort: affordable rewards first (highest value first), then unaffordable (closest first) — R12
  const sorted = [...rewards].sort((a, b) => {
    const aAfford = balance >= a.pointsCost
    const bAfford = balance >= b.pointsCost
    if (aAfford && !bAfford) return -1
    if (!aAfford && bAfford) return 1
    if (aAfford && bAfford) return b.pointsCost - a.pointsCost // most valuable affordable first
    return a.pointsCost - b.pointsCost // closest to afford first
  })

  const affordableRewards = sorted.filter((r) => balance >= r.pointsCost)
  const unavailableRewards = sorted.filter((r) => balance < r.pointsCost)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rewards Catalog</h1>
        <span className="text-sm text-indigo-700 font-medium bg-indigo-50 px-3 py-1 rounded-full">
          {balance.toLocaleString()} pts available
        </span>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">No rewards available yet.</p>
          <p className="text-gray-300 text-xs mt-1">Keep earning points — rewards will appear here.</p>
        </div>
      ) : (
        <>
          {/* Affordable rewards — R12 */}
          {affordableRewards.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Redeem now · {affordableRewards.length} available
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" data-testid="rewards-grid">
                {affordableRewards.map((reward) => (
                  <div key={reward.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:border-indigo-200 transition-colors">
                    <h3 className="font-medium text-gray-900 mb-1">{reward.name}</h3>
                    {reward.description && (
                      <p className="text-sm text-gray-500 mb-3">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-lg font-bold text-indigo-600" data-testid={`reward-cost-${reward.id}`}>
                        {reward.pointsCost.toLocaleString()} pts
                      </span>
                      <button
                        onClick={() => setConfirmReward(reward)}
                        disabled={redeeming === reward.id}
                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        data-testid={`reward-redeem-btn-${reward.id}`}
                      >
                        {redeeming === reward.id ? 'Redeeming…' : 'Redeem'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Unaffordable rewards — R13 */}
          {unavailableRewards.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Earn more points to unlock
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {unavailableRewards.map((reward) => {
                  const needed = reward.pointsCost - balance
                  return (
                    <div key={reward.id} className="border border-gray-100 rounded-xl p-4 bg-white opacity-70">
                      <h3 className="font-medium text-gray-700 mb-1">{reward.name}</h3>
                      {reward.description && (
                        <p className="text-sm text-gray-400 mb-3">{reward.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-base font-bold text-gray-400">
                          {reward.pointsCost.toLocaleString()} pts
                        </span>
                        <div className="text-right">
                          <p className="text-xs text-orange-500 font-medium mb-1" data-testid={`reward-cost-${reward.id}`}>
                            {needed.toLocaleString()} more pts needed
                          </p>
                          <a
                            href="/history"
                            className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                          >
                            Earn faster →
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Redemption Confirmation Dialog */}
      {confirmReward && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Redemption</h3>
            <p className="text-gray-600 text-sm mb-1">
              Redeem <strong>{confirmReward.name}</strong> for{' '}
              <strong>{confirmReward.pointsCost.toLocaleString()} points</strong>?
            </p>
            <p className="text-xs text-gray-400 mb-4">Digital delivery · Available within 24 hours</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRedeem(confirmReward)}
                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                data-testid="confirm-redeem-btn"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmReward(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
                data-testid="cancel-redeem-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Redemption Confirmation — R14 */}
      {redemptionResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Reward Redeemed!</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{redemptionResult.rewardName}</strong>
            </p>
            <div className="text-xs text-gray-400 space-y-0.5 mb-4">
              <p>Digital delivery · Available within 24 hours</p>
              <p>{redemptionResult.pointsCost.toLocaleString()} points deducted · New balance: {balance.toLocaleString()} pts</p>
            </div>
            <button
              onClick={() => setRedemptionResult(null)}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
