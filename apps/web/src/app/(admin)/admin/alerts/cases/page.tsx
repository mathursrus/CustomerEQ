'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface Case {
  id: string
  caseNumber: number
  score: number
  surveyName: string
  feedback: string
  status: 'OPEN' | 'CONTACTED' | 'RESOLVED' | 'CLOSED' | 'OVERDUE'
  assignee: string | null
  slaTarget: string
  createdAt: string
}

interface CaseStats {
  open: number
  contacted: number
  resolved: number
  overdue: number
}

async function getCases(
  token: string | null,
  filters: Record<string, string>
): Promise<{ cases: Case[]; stats: CaseStats }> {
  try {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    const qs = params.toString()
    const res = await fetch(`${API_URL}/v1/cases${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      headers,
    })
    if (!res.ok) return { cases: [], stats: { open: 0, contacted: 0, resolved: 0, overdue: 0 } }
    const data = await res.json()
    return {
      cases: data.cases ?? data ?? [],
      stats: data.stats ?? { open: 0, contacted: 0, resolved: 0, overdue: 0 },
    }
  } catch {
    return { cases: [], stats: { open: 0, contacted: 0, resolved: 0, overdue: 0 } }
  }
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  OVERDUE: 'bg-red-100 text-red-700 animate-pulse',
}

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-red-100 text-red-700'
  if (score <= 6) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function slaStatus(slaTarget: string): { label: string; className: string } {
  const target = new Date(slaTarget)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  const diffH = Math.round(diffMs / (1000 * 60 * 60))

  if (diffMs < 0) {
    return { label: `${Math.abs(diffH)}h overdue`, className: 'text-red-600 font-medium' }
  }
  if (diffH <= 4) {
    return { label: `${diffH}h remaining`, className: 'text-yellow-600 font-medium' }
  }
  return { label: 'On track', className: 'text-green-600 font-medium' }
}

export default function CasesPage() {
  const { getToken } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [stats, setStats] = useState<CaseStats>({ open: 0, contacted: 0, resolved: 0, overdue: 0 })
  const [filters, setFilters] = useState({
    status: '',
    assignee: '',
    sla: '',
    dateFrom: '',
    dateTo: '',
  })

  const loadCases = useCallback(async () => {
    const token = await getToken()
    const data = await getCases(token, filters)
    setCases(data.cases)
    setStats(data.stats)
  }, [getToken, filters])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Management</h1>
          <p className="mt-1 text-sm text-gray-500">Track and resolve customer feedback cases</p>
        </div>
        <Link
          href="/admin/alerts/rules"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Manage Rules
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{stats.open}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacted</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{stats.contacted}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-600 animate-pulse">{stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="filterStatus" className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              id="filterStatus"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CONTACTED">Contacted</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <div>
            <label htmlFor="filterAssignee" className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
            <input
              id="filterAssignee"
              type="text"
              value={filters.assignee}
              onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Filter by assignee"
            />
          </div>
          <div>
            <label htmlFor="filterSla" className="block text-xs font-medium text-gray-500 mb-1">SLA Compliance</label>
            <select
              id="filterSla"
              value={filters.sla}
              onChange={(e) => setFilters((f) => ({ ...f, sla: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label htmlFor="filterDateFrom" className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              id="filterDateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="filterDateTo" className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              id="filterDateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Case #</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Survey</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Feedback</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                  No cases found. Cases are created automatically when alert rules trigger.
                </td>
              </tr>
            ) : (
              cases.map((c) => {
                const sla = slaStatus(c.slaTarget)
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link href={`/admin/alerts/cases/${c.id}`} className="hover:text-indigo-600">
                        #{c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreColor(c.score)}`}>
                        {c.score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{c.surveyName}</td>
                    <td className="px-6 py-4 text-gray-700 max-w-xs truncate">{c.feedback}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{c.assignee ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs ${sla.className}`}>{sla.label}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
