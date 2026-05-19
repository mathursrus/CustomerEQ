'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import CampaignActions from './CampaignActions'

interface Campaign {
  id: string
  name: string
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'COMPLETED'
  triggerType: string
  actionType: string
  budgetSpent: number
  budgetCap: number | null
  createdAt: string
  startDate: string | null
  endDate: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
}

const actionTypeLabels: Record<string, string> = {
  award_points: 'Award Points',
  send_message: 'Send Message',
  spin_wheel: 'Spin Wheel',
  award_reward: 'Award Reward',
}

export default function CampaignsPage() {
  const { getToken } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCampaigns() {
      try {
        const token = await getAuthToken(getToken)
        const res = await fetch(`${API_URL}/v1/campaigns`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          if (!cancelled) {
            setCampaigns([])
          }
          return
        }

        const data = await res.json()
        if (!cancelled) {
          setCampaigns(data.data ?? data.campaigns ?? (Array.isArray(data) ? data : []))
        }
      } catch {
        if (!cancelled) {
          setCampaigns([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCampaigns()

    return () => {
      cancelled = true
    }
  }, [getToken])

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Loading campaigns...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">Automate loyalty actions based on CX events</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          data-testid="create-campaign-btn"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Campaign
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table data-testid="campaigns-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No campaigns yet.{' '}
                    <Link href="/admin/campaigns/new" className="text-indigo-600 hover:underline">
                      Create your first campaign
                    </Link>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 group">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.actionType === 'spin_wheel' && (
                        <span className="ml-2 text-xs text-indigo-500">&#127921;</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {actionTypeLabels[campaign.actionType] ?? campaign.actionType}
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                      {campaign.triggerType}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      ${campaign.budgetSpent?.toFixed(0) ?? 0}
                      {campaign.budgetCap != null ? ` / $${campaign.budgetCap}` : ''}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <CampaignActions campaign={campaign} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
