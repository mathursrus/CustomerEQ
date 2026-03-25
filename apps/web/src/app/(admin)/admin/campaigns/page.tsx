import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Campaign {
  id: string
  name: string
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'ARCHIVED'
  triggerType: string
  actionType: string
  budgetSpent: number
  budgetCap: number | null
  createdAt: string
}

async function getCampaigns(): Promise<Campaign[]> {
  try {
    const { getToken } = await auth()
    const token = await getToken()
    const res = await fetch(`${API_URL}/v1/campaigns`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.campaigns ?? data ?? []
  } catch {
    return []
  }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-700',
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns()

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
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger Type</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget Spent/Cap</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No campaigns yet.{' '}
                    <Link href="/admin/campaigns/new" className="text-indigo-600 hover:underline">
                      Create your first campaign
                    </Link>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{campaign.triggerType}</td>
                    <td className="px-6 py-4 text-gray-700">{campaign.actionType}</td>
                    <td className="px-6 py-4 text-gray-700">
                      {campaign.budgetSpent ?? 0} / {campaign.budgetCap != null ? campaign.budgetCap : '∞'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(campaign.createdAt).toLocaleDateString()}
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
