'use client'

import { useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import CampaignForm from '@/components/campaigns/CampaignForm'

export default function NewCampaignPage() {
  const searchParams = useSearchParams()
  const { getToken } = useAuth()

  // Pre-fill segment condition from dashboard click-through (filter=detractors)
  const filterParam = searchParams.get('filter')
  const maxNpsParam = searchParams.get('maxNps')
  const initialData = filterParam === 'detractors'
    ? {
        conditionField: 'nps_score',
        conditionOperator: 'between',
        conditionValue: `0,${maxNpsParam ?? '6'}`,
      }
    : undefined

  async function handleCreate(payload: Record<string, unknown>) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_URL}/v1/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error ?? data?.message ?? `Failed with status ${res.status}`)
    }
    return res.json()
  }

  return <CampaignForm initialData={initialData} onSubmit={handleCreate} />
}
