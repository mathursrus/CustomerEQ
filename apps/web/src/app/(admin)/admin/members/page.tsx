'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { FilterBar } from '@/components/ui/filter-bar'
import { PaginatedTable, type Column } from '@/components/ui/paginated-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { HealthScoreBadge } from '@/components/health-score/HealthScoreBadge'

interface Member {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  pointsBalance: number
  status: string
  tierName: string | null
  healthScore: number | null
  healthScoreUpdatedAt: string | null
  latestSentiment: number | null
  latestNpsScore: number | null
  createdAt: string
}

interface MembersResponse {
  data: Member[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const FILTERS = [
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
]

const columns: Column<Member>[] = [
  {
    key: 'member',
    label: 'Member',
    render: (m) => {
      const initials =
        (m.firstName?.[0] ?? '') + (m.lastName?.[0] ?? '') || m.email[0]?.toUpperCase() || '?'
      const colors = getAvatarColors(m.healthScore)
      return (
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center ${colors.text} text-xs font-bold`}
          >
            {initials.toUpperCase()}
          </div>
          <div>
            <Link
              href={`/admin/members/${m.id}`}
              className="font-medium text-gray-900 hover:text-indigo-600"
            >
              {m.firstName || m.lastName
                ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()
                : m.email}
            </Link>
            <div className="text-xs text-gray-400">{m.email}</div>
          </div>
        </div>
      )
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (m) => <StatusBadge status={m.status} />,
  },
  {
    key: 'tier',
    label: 'Tier',
    render: (m) => <span className="text-gray-600">{m.tierName ?? '—'}</span>,
  },
  {
    key: 'points',
    label: 'Points',
    render: (m) => (
      <span className="tabular-nums text-gray-900 text-right block">
        {m.pointsBalance.toLocaleString()}
      </span>
    ),
  },
  {
    key: 'healthScore',
    label: 'Health Score',
    render: (m) => (
      <div className="text-center">
        <HealthScoreBadge score={m.healthScore} size="sm" />
      </div>
    ),
  },
  {
    key: 'createdAt',
    label: 'Enrolled',
    render: (m) => (
      <span className="text-gray-500 text-xs">
        {new Date(m.createdAt).toLocaleDateString()}
      </span>
    ),
  },
]

function getAvatarColors(healthScore: number | null): { bg: string; text: string } {
  if (healthScore === null) return { bg: 'bg-gray-100', text: 'text-gray-500' }
  if (healthScore <= 20) return { bg: 'bg-red-100', text: 'text-red-600' }
  if (healthScore <= 40) return { bg: 'bg-orange-100', text: 'text-orange-600' }
  if (healthScore <= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-600' }
  return { bg: 'bg-green-100', text: 'text-green-600' }
}

type HealthPreset = 'all' | 'critical' | 'at-risk' | 'healthy'

export default function MembersPage() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [members, setMembers] = useState<Member[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Health score range filter
  const [healthMin, setHealthMin] = useState<string>('')
  const [healthMax, setHealthMax] = useState<string>('')
  const [activePreset, setActivePreset] = useState<HealthPreset>('all')

  // Recompute status
  const [recomputing, setRecomputing] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken(getToken)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: 'healthScore',
        sortOrder: 'desc',
      })
      if (search) params.set('q', search)
      if (filterValues.status) params.set('status', filterValues.status)
      if (healthMin) params.set('healthScoreMin', healthMin)
      if (healthMax) params.set('healthScoreMax', healthMax)

      const res = await fetch(`${API_URL}/v1/members?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const json: MembersResponse = await res.json()
      setMembers(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [getToken, page, pageSize, search, filterValues, healthMin, healthMax])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const applyPreset = (preset: HealthPreset) => {
    setActivePreset(preset)
    setPage(1)
    switch (preset) {
      case 'critical':
        setHealthMin('0')
        setHealthMax('39')
        break
      case 'at-risk':
        setHealthMin('0')
        setHealthMax('59')
        break
      case 'healthy':
        setHealthMin('80')
        setHealthMax('100')
        break
      default:
        setHealthMin('')
        setHealthMax('')
    }
  }

  const handleRecompute = async () => {
    setRecomputing(true)
    try {
      const token = await getAuthToken(getToken)
      await fetch(`${API_URL}/v1/admin/health-scores/recompute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      // Refetch after a short delay to allow some processing
      setTimeout(() => {
        void fetchMembers()
        setRecomputing(false)
      }, 2000)
    } catch {
      setRecomputing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage loyalty program members</p>
        </div>
      </div>

      {/* Filter bar with health score range */}
      <div className="space-y-3">
        <FilterBar
          search={search}
          onSearchChange={handleSearchChange}
          filters={FILTERS}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          placeholder="Search by name, email..."
        />

        {/* Health score filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Health Score Range */}
            <div className="border-l border-gray-200 pl-4">
              <label className="block text-xs text-gray-500 mb-1">Health Score Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={100}
                  value={healthMin}
                  onChange={(e) => {
                    setHealthMin(e.target.value)
                    setActivePreset('all')
                    setPage(1)
                  }}
                  className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={100}
                  value={healthMax}
                  onChange={(e) => {
                    setHealthMax(e.target.value)
                    setActivePreset('all')
                    setPage(1)
                  }}
                  className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick Filter Presets */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quick Filters</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => applyPreset('critical')}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    activePreset === 'critical'
                      ? 'border-red-400 text-red-800 bg-red-100'
                      : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                  }`}
                >
                  Critical &lt;40
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('at-risk')}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    activePreset === 'at-risk'
                      ? 'border-orange-400 text-orange-800 bg-orange-100'
                      : 'border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100'
                  }`}
                >
                  At Risk &lt;60
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('healthy')}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    activePreset === 'healthy'
                      ? 'border-green-400 text-green-800 bg-green-100'
                      : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  Healthy 80+
                </button>
                {activePreset !== 'all' && (
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="px-2 py-1 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaginatedTable<Member>
        columns={columns}
        data={members}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onRowDoubleClick={(m) => router.push(`/admin/members/${m.id}`)}
        renderRowActions={(m) => (
          <Link
            href={`/admin/members/${m.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
          >
            View
          </Link>
        )}
        testId="members-table"
        emptyMessage={
          loading ? (
            <span className="text-gray-400">Loading...</span>
          ) : (
            <span className="text-gray-400">No members found.</span>
          )
        }
      />

      {/* Batch Computation Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Health Score Status:</span>{' '}
          Showing {total} members
          {healthMin || healthMax
            ? ` (filtered: ${healthMin || '0'}–${healthMax || '100'})`
            : ''}
        </div>
        <button
          type="button"
          onClick={() => void handleRecompute()}
          disabled={recomputing}
          className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {recomputing ? 'Recalculating...' : 'Recalculate Now'}
        </button>
      </div>
    </div>
  )
}
