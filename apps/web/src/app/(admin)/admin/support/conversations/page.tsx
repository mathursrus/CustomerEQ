'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

/* ─── Types ────────────────────────────────────────────────────────────── */

interface Conversation {
  id: string
  status: string
  intent: string | null
  topic: string | null
  assignee: string | null
  member: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
  _count: { messages: number }
  createdAt: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  WAITING_ON_CUSTOMER: 'bg-yellow-100 text-yellow-700',
  ESCALATED: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-700',
}

/* ─── Component ────────────────────────────────────────────────────────── */

export default function SupportConversationsPage() {
  const { getToken } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const loadConversations = useCallback(async () => {
    const token = await getAuthToken(getToken)
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`${API_URL}/v1/support/conversations?${params}`, {
        cache: 'no-store',
        headers,
      })
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {
      // ignore
    }
  }, [getToken, page, statusFilter])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const totalPages = Math.ceil(total / 25) || 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Conversations</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage customer support conversations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label htmlFor="filterStatus" className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              id="filterStatus"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {total} conversation{total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Member
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Intent
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assignee
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Messages
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conversations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No conversations found.
                </td>
              </tr>
            ) : (
              conversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/support/conversations/${conv.id}`}
                      className="hover:text-indigo-600"
                    >
                      <div className="font-medium text-gray-900">
                        {conv.member.firstName ?? ''} {conv.member.lastName ?? ''}
                      </div>
                      <div className="text-xs text-gray-500">{conv.member.email}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{conv.intent ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[conv.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {conv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{conv.assignee ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{conv._count.messages}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
