'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface Campaign {
  id: string
  name: string
  programId: string
  triggerType: string
  triggerCondition: Record<string, unknown> | null
  actionType: string
  actionConfig: Record<string, unknown>
  budgetCap: number | null
  budgetSpent: number
  startDate: string | null
  endDate: string | null
  status: string
}

export default function EditCampaignPage() {
  const params = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [budgetCap, setBudgetCap] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const isActive = campaign?.status === 'ACTIVE'

  useEffect(() => {
    async function load() {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/campaigns/${campaignId}`, { headers })
      if (!res.ok) { setError('Campaign not found'); setLoading(false); return }
      const data: Campaign = await res.json()
      setCampaign(data)
      setName(data.name)
      setBudgetCap(data.budgetCap?.toString() ?? '')
      setTriggerType(data.triggerType)
      setStartDate(data.startDate ? data.startDate.split('T')[0] : '')
      setEndDate(data.endDate ? data.endDate.split('T')[0] : '')
      setLoading(false)
    }
    load()
  }, [campaignId, getToken])

  async function handleSave() {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const body: Record<string, unknown> = { name }
      if (budgetCap) body.budgetCap = Number(budgetCap)
      else body.budgetCap = null

      if (!isActive) {
        body.triggerType = triggerType
        if (startDate) body.startDate = new Date(startDate).toISOString()
        if (endDate) body.endDate = new Date(endDate).toISOString()
      }

      const res = await fetch(`${API_URL}/v1/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed with status ${res.status}`)
      }

      setSuccess(true)
      setTimeout(() => router.push('/admin/campaigns'), 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto py-12 text-center text-gray-400">Loading campaign...</div>
  }

  if (!campaign) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-red-500 mb-4">{error ?? 'Campaign not found'}</p>
        <button onClick={() => router.push('/admin/campaigns')} className="text-indigo-600 hover:underline text-sm">Back to campaigns</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Campaign</h1>
        <p className="mt-1 text-sm text-gray-500">
          {campaign.name} — <span className={`font-medium ${campaign.status === 'ACTIVE' ? 'text-green-600' : campaign.status === 'DRAFT' ? 'text-gray-500' : 'text-yellow-600'}`}>{campaign.status}</span>
        </p>
        {isActive && (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            This campaign is active. Only name and budget cap can be edited.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-5 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Saved! Redirecting...</div>
        )}

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" data-testid="edit-campaign-name" />
          </div>

          {/* Budget Cap */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Cap (USD)</label>
            <input type="number" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="No limit" data-testid="edit-budget-cap" />
            {campaign.budgetSpent > 0 && (
              <p className="mt-1 text-xs text-gray-500">Budget spent so far: ${campaign.budgetSpent.toFixed(2)}</p>
            )}
          </div>

          {/* Trigger Type (disabled if active) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type {isActive && <span className="text-xs text-amber-500">(locked)</span>}</label>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} disabled={isActive} className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300'}`} data-testid="edit-trigger-type">
              <option value="cx.nps_submitted">cx.nps_submitted</option>
              <option value="cx.ticket_resolved">cx.ticket_resolved</option>
              <option value="purchase">purchase</option>
            </select>
          </div>

          {/* Dates (disabled if active) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date {isActive && <span className="text-xs text-amber-500">(locked)</span>}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isActive} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300'}`} data-testid="edit-start-date" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date {isActive && <span className="text-xs text-amber-500">(locked)</span>}</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isActive} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300'}`} data-testid="edit-end-date" />
            </div>
          </div>

          {/* Action Type (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type <span className="text-xs text-gray-400">(cannot change)</span></label>
            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              {campaign.actionType === 'spin_wheel' ? 'Spin Wheel' : campaign.actionType === 'scratch_card' ? 'Scratch Card' : campaign.actionType === 'mystery_box' ? 'Mystery Box' : campaign.actionType === 'award_points' ? 'Award Points' : campaign.actionType}
            </div>
          </div>

          {/* Action Config (read-only summary for interactive types) */}
          {['spin_wheel', 'scratch_card', 'mystery_box'].includes(campaign.actionType) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {campaign.actionType === 'spin_wheel' ? 'Wheel Segments' : 'Prize Pool'}
                <span className="text-xs text-gray-400 ml-1">(edit in creation form — coming soon)</span>
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                {(
                  (campaign.actionConfig as { segments?: Array<{ label: string; probability: number }> }).segments ??
                  (campaign.actionConfig as { prizes?: Array<{ label: string; probability: number }> }).prizes ?? []
                ).map((item: { label: string; probability: number }, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.label}</span>
                    <span className="text-gray-400">{item.probability}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => router.push('/admin/campaigns')} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors" data-testid="edit-save-btn">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
