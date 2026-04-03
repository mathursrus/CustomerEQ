'use client'

import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import CampaignForm from '@/components/campaigns/CampaignForm'

export default function NewCampaignPage() {
  const { getToken } = useAuth()

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

  return <CampaignForm onSubmit={handleCreate} />
}
