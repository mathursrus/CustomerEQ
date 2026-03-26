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

export default function RewardsPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        setSuccess(`Successfully redeemed "${reward.name}"!`)
        setConfirmReward(null)
        setTimeout(() => setSuccess(null), 4000)
      } else {
        const data = await res.json().catch(() => ({}))
        const msg: string = data?.message ?? data?.error ?? ''
        if (res.status === 422 || msg.toLowerCase().includes('insufficient')) {
          setError('Insufficient points balance')
        } else {
          setError(msg || 'Redemption failed. Please try again.')
        }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rewards Catalog</h1>
        <span className="text-sm text-indigo-700 font-medium bg-indigo-50 px-3 py-1 rounded-full">
          {balance.toLocaleString()} pts available
        </span>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {rewards.length === 0 ? (
        <p className="text-gray-500">No rewards available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="rewards-grid">
          {rewards.map((reward) => {
            const canRedeem = balance >= reward.pointsCost
            return (
              <div key={reward.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                <h3 className="font-medium text-gray-900 mb-1">{reward.name}</h3>
                {reward.description && (
                  <p className="text-sm text-gray-500 mb-3">{reward.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <span
                    className="text-lg font-bold text-indigo-600"
                    data-testid={`reward-cost-${reward.id}`}
                  >
                    {reward.pointsCost.toLocaleString()} pts
                  </span>
                  <button
                    onClick={() => setConfirmReward(reward)}
                    disabled={!canRedeem || redeeming === reward.id}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    data-testid={`reward-redeem-btn-${reward.id}`}
                  >
                    {redeeming === reward.id ? 'Redeeming...' : 'Redeem'}
                  </button>
                </div>
                {!canRedeem && (
                  <p className="text-xs text-gray-400 mt-1">
                    Need {(reward.pointsCost - balance).toLocaleString()} more pts
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmReward && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Redemption</h3>
            <p className="text-gray-600 text-sm mb-4">
              Redeem <strong>{confirmReward.name}</strong> for{' '}
              <strong>{confirmReward.pointsCost.toLocaleString()} points</strong>?
            </p>
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
    </div>
  )
}
