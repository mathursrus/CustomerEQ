'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { FilterBar } from '@/components/ui/filter-bar'
import { PaginatedTable, type Column } from '@/components/ui/paginated-table'
import { StatusBadge } from '@/components/ui/status-badge'

interface Program {
  id: string
  name: string
  type: 'POINTS' | 'TIERED' | 'CASHBACK' | 'HYBRID'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  startDate: string | null
  endDate: string | null
  budgetUsdCents: number | null
  pointCurrencyName: string
  createdAt: string
  _count?: { members: number }
}

interface ProgramsResponse {
  data: Program[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const TYPE_OPTIONS = [
  { value: 'POINTS', label: 'Points' },
  { value: 'TIERED', label: 'Tiered' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'HYBRID', label: 'Hybrid' },
]

const FILTERS = [
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
  { key: 'type', label: 'Type', options: TYPE_OPTIONS },
]

const columns: Column<Program>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (p) => (
      <Link href={`/admin/programs/${p.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
        {p.name}
      </Link>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    render: (p) => (
      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
        {p.type}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (p) => <StatusBadge status={p.status} />,
  },
  {
    key: 'dates',
    label: 'Dates',
    render: (p) => {
      if (!p.startDate && !p.endDate) return <span className="text-gray-400">—</span>
      const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '∞')
      return (
        <span className="text-xs text-gray-600">
          {fmt(p.startDate)} – {fmt(p.endDate)}
        </span>
      )
    },
  },
  {
    key: 'members',
    label: 'Members',
    render: (p) => (
      <span className="tabular-nums text-gray-700">{p._count?.members?.toLocaleString() ?? '—'}</span>
    ),
  },
  {
    key: 'budget',
    label: 'Budget',
    render: (p) =>
      p.budgetUsdCents != null ? (
        <span className="tabular-nums text-gray-700">
          {(p.budgetUsdCents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
]

export default function ProgramsPage() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [programs, setPrograms] = useState<Program[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setLoading(true)
    try {
      const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (search) params.set('search', search)
      if (filterValues.status) params.set('status', filterValues.status)
      if (filterValues.type) params.set('type', filterValues.type)

      const res = await fetch(`${API_URL}/v1/programs?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const json: ProgramsResponse = await res.json()
      setPrograms(json.data ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [getToken, page, pageSize, search, filterValues])

  useEffect(() => {
    void fetchPrograms()
  }, [fetchPrograms])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleStatusChange = async (program: Program, newStatus: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') => {
    setActionError(null)
    try {
      const token = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true' ? null : await getToken()
      const res = await fetch(`${API_URL}/v1/programs/${program.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        setActionError(err.message ?? 'Failed to update program status')
        return
      }
      await fetchPrograms()
    } catch {
      setActionError('Network error — please try again')
    }
  }

  const handleDelete = async (program: Program) => {
    if (!confirm(`Delete draft "${program.name}"? This cannot be undone.`)) return
    await handleStatusChange(program, 'ARCHIVED')
  }

  const renderRowActions = (p: Program) => (
    <>
      <Link
        href={`/admin/programs/${p.id}/edit`}
        onClick={(e) => e.stopPropagation()}
        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Edit
      </Link>
      {p.status === 'ACTIVE' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleStatusChange(p, 'PAUSED') }}
          className="rounded border border-yellow-300 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-50 transition-colors"
        >
          Pause
        </button>
      )}
      {p.status === 'PAUSED' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleStatusChange(p, 'ACTIVE') }}
          className="rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
        >
          Reactivate
        </button>
      )}
      {p.status === 'DRAFT' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleDelete(p) }}
          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      )}
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your loyalty programs</p>
        </div>
        <Link
          href="/admin/programs/new"
          data-testid="create-program-btn"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Create Program
        </Link>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        filters={FILTERS}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        placeholder="Search programs..."
      />

      <PaginatedTable<Program>
        columns={columns}
        data={programs}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        onRowDoubleClick={(p) => router.push(`/admin/programs/${p.id}`)}
        renderRowActions={renderRowActions}
        testId="programs-table"
        emptyMessage={
          loading ? (
            <span className="text-gray-400">Loading...</span>
          ) : (
            <>
              No programs yet.{' '}
              <Link href="/admin/programs/new" className="text-indigo-600 hover:underline">
                Create your first program
              </Link>
            </>
          )
        }
      />
    </div>
  )
}
