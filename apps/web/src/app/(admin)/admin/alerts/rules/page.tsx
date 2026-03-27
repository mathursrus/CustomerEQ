'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface AlertRule {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED'
  channels: {
    slackWebhookUrl?: string | null
    emailRecipients?: string[]
    teamsWebhookUrl?: string | null
  }
  _count?: { cases: number }
  slaHours: number
  createdAt: string
}

async function getAlertRules(token: string | null): Promise<AlertRule[]> {
  try {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/alert-rules`, { cache: 'no-store', headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.alertRules ?? data ?? []
  } catch {
    return []
  }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
}

function ChannelIcons({ channels }: { channels: AlertRule['channels'] }) {
  return (
    <div className="flex items-center gap-2">
      {channels.slackWebhookUrl && (
        <span title="Slack" className="inline-flex items-center justify-center h-6 w-6 rounded bg-purple-100 text-purple-700">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
          </svg>
        </span>
      )}
      {channels.emailRecipients && channels.emailRecipients.length > 0 && (
        <span title={`Email (${channels.emailRecipients.length})`} className="inline-flex items-center justify-center h-6 w-6 rounded bg-blue-100 text-blue-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </span>
      )}
      {channels.teamsWebhookUrl && (
        <span title="Teams" className="inline-flex items-center justify-center h-6 w-6 rounded bg-indigo-100 text-indigo-700">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.404 4.478c0 1.242-1.005 2.249-2.245 2.249s-2.246-1.007-2.246-2.249S15.919 2.23 17.16 2.23s2.245 1.007 2.245 2.248zm2.386 3.058h-5.26a1.2 1.2 0 00-1.198 1.2v5.586a4.087 4.087 0 002.218 3.636 4.082 4.082 0 004.24-6.986V7.536zm-7.9-.533a2.81 2.81 0 10-2.809-2.81 2.81 2.81 0 002.81 2.81zm1.353 1.199h-6.3a1.2 1.2 0 00-1.2 1.2v6.352a5.146 5.146 0 005.05 5.22 5.146 5.146 0 005.05-5.22V9.602a1.6 1.6 0 00-1.6-1.6z" />
          </svg>
        </span>
      )}
      {!channels.slackWebhookUrl && (!channels.emailRecipients || channels.emailRecipients.length === 0) && !channels.teamsWebhookUrl && (
        <span className="text-xs text-gray-400">None</span>
      )}
    </div>
  )
}

export default function AlertRulesPage() {
  const { getToken } = useAuth()
  const [rules, setRules] = useState<AlertRule[]>([])

  useEffect(() => {
    getToken().then((token) => getAlertRules(token).then(setRules))
  }, [getToken])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Rules</h1>
          <p className="mt-1 text-sm text-gray-500">Configure automated alerts for customer feedback</p>
        </div>
        <Link
          href="/admin/alerts/rules/new"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Rule
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Channels</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cases</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No alert rules yet.{' '}
                  <Link href="/admin/alerts/rules/new" className="text-indigo-600 hover:underline">
                    Create your first rule
                  </Link>
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{rule.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[rule.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <ChannelIcons channels={rule.channels} />
                  </td>
                  <td className="px-6 py-4 text-gray-700">{rule._count?.cases ?? 0}</td>
                  <td className="px-6 py-4 text-gray-700">{rule.slaHours}h</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(rule.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
