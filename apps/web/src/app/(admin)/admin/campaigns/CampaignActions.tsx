'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface Campaign {
  id: string
  status: string
  actionType: string
}

export default function CampaignActions({ campaign }: { campaign: Campaign }) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [embedCopied, setEmbedCopied] = useState(false)

  async function updateStatus(newStatus: string) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_URL}/v1/campaigns/${campaign.id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/admin/campaigns/${campaign.id}/edit`}
        className="text-xs font-medium text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
        data-testid={`edit-campaign-${campaign.id}`}
      >
        Edit
      </Link>
      {campaign.status === 'DRAFT' && (
        <button
          onClick={() => updateStatus('ACTIVE')}
          className="text-xs font-medium text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors"
          data-testid={`activate-campaign-${campaign.id}`}
        >
          Activate
        </button>
      )}
      {campaign.status === 'ACTIVE' && (
        <button
          onClick={() => updateStatus('PAUSED')}
          className="text-xs font-medium text-yellow-600 hover:text-yellow-800 px-2 py-1 rounded hover:bg-yellow-50 transition-colors"
          data-testid={`pause-campaign-${campaign.id}`}
        >
          Pause
        </button>
      )}
      {campaign.status === 'PAUSED' && (
        <button
          onClick={() => updateStatus('ACTIVE')}
          className="text-xs font-medium text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors"
          data-testid={`resume-campaign-${campaign.id}`}
        >
          Resume
        </button>
      )}
      {campaign.actionType === 'spin_wheel' && (
        <button
          onClick={() => {
            const code = `<script src="https://cdn.customereq.com/components/v1/ceq-components.js"></script>\n<ceq-spin-wheel campaign-id="${campaign.id}" token="{{MEMBER_TOKEN}}"></ceq-spin-wheel>`
            navigator.clipboard.writeText(code)
            setEmbedCopied(true)
            setTimeout(() => setEmbedCopied(false), 2000)
          }}
          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${embedCopied ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'}`}
          data-testid={`embed-code-${campaign.id}`}
          title="Copy embed code"
        >
          {embedCopied ? 'Copied!' : 'Embed'}
        </button>
      )}
    </div>
  )
}
