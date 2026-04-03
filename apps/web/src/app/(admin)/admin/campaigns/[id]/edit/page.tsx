'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import CampaignForm, { type CampaignFormInitialData } from '@/components/campaigns/CampaignForm'

interface Campaign {
  id: string
  name: string
  programId: string
  triggerType: string
  triggerCondition: { field?: string; op?: string; value?: unknown } | null
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/v1/campaigns/${campaignId}`, { headers })
      if (!res.ok) { setError('Campaign not found'); setLoading(false); return }
      const data: Campaign = await res.json()
      setCampaign(data)
      setLoading(false)
    }
    load()
  }, [campaignId, getToken])

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

  // Map campaign data to form initial data
  const config = campaign.actionConfig as Record<string, unknown>
  const segments = (config.segments ?? []) as Array<{ points: number; probability: number; label: string; color: string }>
  const prizes = (config.prizes ?? []) as Array<{ points: number; probability: number; label: string }>

  const initialData: CampaignFormInitialData = {
    name: campaign.name,
    programId: campaign.programId,
    triggerType: campaign.triggerType,
    conditionField: campaign.triggerCondition?.field as string ?? '',
    conditionOperator: campaign.triggerCondition?.op as string ?? '',
    conditionValue: String(campaign.triggerCondition?.value ?? ''),
    actionType: campaign.actionType,
    actionPoints: campaign.actionType === 'award_points' ? String((config.points as number) ?? '') : '',
    actionMessage: campaign.actionType === 'send_message' ? String((config.message as string) ?? '') : '',
    budgetCap: campaign.budgetCap?.toString() ?? '',
    startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
    endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
    segments: segments.length > 0 ? segments : undefined,
    wheelStyle: (config.wheelStyle as 'classic' | 'neon' | 'minimal') ?? 'classic',
    prizes: prizes.length > 0 ? prizes : undefined,
    cardStyle: (config.cardStyle as 'gold' | 'silver' | 'holiday' | 'branded') ?? (config.boxStyle === 'treasure' ? 'silver' : config.boxStyle === 'branded' ? 'branded' : 'gold'),
    scratchText: (config.scratchText as string) ?? 'Scratch to reveal!',
  }

  async function handleUpdate(payload: Record<string, unknown>) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_URL}/v1/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error ?? data?.message ?? `Failed with status ${res.status}`)
    }
    return res.json()
  }

  return (
    <CampaignForm
      initialData={initialData}
      mode="edit"
      onSubmit={handleUpdate}
      title="Edit Campaign"
      subtitle={`${campaign.name} — ${campaign.status}`}
      lockActionType={campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED'}
    />
  )
}
