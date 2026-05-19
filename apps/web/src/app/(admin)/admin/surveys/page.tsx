'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { PaginatedTable, type Column } from '@/components/ui/paginated-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { FilterChipGroup } from '@/components/filters/FilterChipGroup'
import { SurveyRowMenu, type SurveyState } from './components/SurveyRowMenu'
import { STATUS_GROUP, TYPE_GROUP, TYPE_PILL, relTime } from './list-page.logic'

// Issue #241 Slice 3 — surveys list rewrite per spec §1.

interface Survey {
  id: string
  name: string
  description: string | null
  programId: string
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  status: SurveyState
  updatedAt: string
  _count?: { responses: number }
}

interface SurveysResponse {
  data: Survey[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface ProgramLite {
  id: string
  name: string
}

export default function SurveysPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [surveys, setSurveys] = useState<Survey[]>([])
  // `null` = not yet fetched; `{}` = fetched and the brand has zero programs
  // (distinguishes the loading flicker from the "fresh brand" empty state).
  const [programs, setPrograms] = useState<Record<string, string> | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [actionError, setActionError] = useState<string | null>(null)

  // URL-driven filter state. Initialize from search params so a shared/bookmarked
  // URL renders the same filtered view.
  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    return {
      status: status ? status.split(',').filter(Boolean) : [],
      type: type ? type.split(',').filter(Boolean) : [],
    }
  })

  const fetchSurveys = useCallback(async () => {
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/surveys`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const json = (await res.json()) as SurveysResponse
      setSurveys(json.data ?? [])
      setTotal(json.total ?? (json.data?.length ?? 0))
    } catch {
      setSurveys([])
    }
  }, [getToken])

  // Fetch programs once for the Name-column meta-line join (Survey has programId
  // but no Prisma relation; client-side lookup avoids extending the API schema).
  const fetchPrograms = useCallback(async () => {
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/programs`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        // Treat HTTP failure as "loaded, none known" so the page falls back to
        // the safest UX (disabled "+ New survey" + empty-state hint) rather
        // than promising an action that will server-side-error.
        setPrograms({})
        return
      }
      const json = (await res.json()) as { data?: ProgramLite[]; programs?: ProgramLite[] }
      const list = json.data ?? json.programs ?? []
      setPrograms(Object.fromEntries(list.map((p) => [p.id, p.name])))
    } catch {
      setPrograms({})
    }
  }, [getToken])

  useEffect(() => {
    void fetchSurveys()
    void fetchPrograms()
  }, [fetchSurveys, fetchPrograms])

  // Sync filter state to the URL so the view is shareable.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.status?.length) params.set('status', filters.status.join(','))
    if (filters.type?.length) params.set('type', filters.type.join(','))
    const qs = params.toString()
    router.replace(qs ? `/admin/surveys?${qs}` : '/admin/surveys', { scroll: false })
  }, [filters, router])

  const handleFilterChange = (key: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }))
    setPage(1)
  }

  // Treat the button as enabled while programs are still loading (initial null);
  // disable only after we've confirmed the brand has zero programs.
  const programsLoaded = programs !== null
  const hasPrograms = !programsLoaded || Object.keys(programs).length > 0
  // Fresh-brand state: both fetches resolved AND both are empty. Surfaces a
  // stronger empty state that points the operator at /admin/programs/new.
  const isFreshBrand = programsLoaded && Object.keys(programs).length === 0 && surveys.length === 0

  // Client-side filtering — current page size (25) keeps this trivial.
  // If list grows large enough to need server-side filtering, push the
  // values into the GET /v1/surveys query string.
  const filtered = surveys.filter((s) => {
    const sFilter = filters.status ?? []
    const tFilter = filters.type ?? []
    if (sFilter.length && !sFilter.includes(s.status)) return false
    if (tFilter.length && !tFilter.includes(s.type)) return false
    return true
  })

  // Helper for SurveyRowMenu — supertest-style fetch with bearer auth.
  const callApi = useCallback(
    async (path: string, init?: { method?: string; body?: unknown }) => {
      const token = await getAuthToken(getToken)
      return fetch(`${API_URL}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      })
    },
    [getToken],
  )

  const columns: Column<Survey>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (s) => {
        const programName = programs?.[s.programId]
        return (
          <div>
            <Link
              href={`/admin/surveys/${s.id}`}
              className="font-medium text-slate-900 hover:text-indigo-600"
            >
              {s.name}
            </Link>
            {(s.description || programName) && (
              <div className="mt-0.5 text-xs text-slate-500">
                {s.description ? <span>{s.description}</span> : null}
                {s.description && programName ? <span> · </span> : null}
                {programName ? <span>{programName}</span> : null}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (s) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_PILL[s.type] ?? 'bg-slate-100 text-slate-600'}`}
        >
          {s.type === 'CUSTOM' ? 'Custom' : s.type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: 'responses',
      label: 'Responses',
      render: (s) => (
        <span className="tabular-nums text-slate-700">{s._count?.responses ?? 0}</span>
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      render: (s) => <span className="text-xs text-slate-500">{relTime(s.updatedAt)}</span>,
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Surveys</h1>
          <p className="mt-1 text-sm text-slate-500">Manage NPS, CSAT, CES and custom surveys</p>
        </div>
        {hasPrograms ? (
          <Link
            href="/admin/surveys/new"
            data-testid="create-survey-btn"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            + New survey
          </Link>
        ) : (
          // Survey rows must reference a Program, and Brand has no programs yet.
          // Render as a non-interactive span (title attr is unreliable on
          // disabled <button>s in some browsers).
          <span
            data-testid="create-survey-btn-disabled"
            title="Create a program first to enable surveys."
            aria-disabled="true"
            className="rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
          >
            + New survey
          </span>
        )}
      </div>

      {isFreshBrand ? (
        <div
          data-testid="surveys-fresh-brand-empty"
          className="rounded-xl border border-slate-200 bg-white p-12 text-center"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Set up your loyalty program first
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Surveys collect feedback against a loyalty program. Create your program
            first to start sending NPS, CSAT, CES, and custom surveys to your customers.
          </p>
          <Link
            href="/admin/programs/new"
            className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Create program
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4" data-testid="filter-chips">
            <FilterChipGroup
              groupKey={STATUS_GROUP.key}
              label={STATUS_GROUP.label}
              options={STATUS_GROUP.options}
              selected={filters[STATUS_GROUP.key] ?? []}
              onChange={(next) => handleFilterChange(STATUS_GROUP.key, next)}
            />
            <FilterChipGroup
              groupKey={TYPE_GROUP.key}
              label={TYPE_GROUP.label}
              options={TYPE_GROUP.options}
              selected={filters[TYPE_GROUP.key] ?? []}
              onChange={(next) => handleFilterChange(TYPE_GROUP.key, next)}
            />
          </div>

          {actionError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          <PaginatedTable<Survey>
        testId="surveys-table"
        columns={columns}
        data={filtered}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowDoubleClick={(s) => router.push(`/admin/surveys/${s.id}`)}
        renderRowActions={(s) => (
          <div className="flex items-center justify-end gap-1.5">
            <Link
              href={`/admin/surveys/${s.id}/edit`}
              data-testid={`survey-row-edit-${s.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              aria-label="Edit"
            >
              ✎
            </Link>
            <SurveyRowMenu
              surveyId={s.id}
              state={s.status}
              surveyName={s.name}
              callApi={callApi}
              onActionComplete={() => {
                setActionError(null)
                void fetchSurveys()
              }}
              onActionError={(msg) => setActionError(msg)}
            />
          </div>
        )}
        emptyMessage={
          <span>
            No surveys yet.{' '}
            <Link href="/admin/surveys/new" className="text-indigo-600 hover:underline">
              Create your first survey
            </Link>
          </span>
        }
      />
        </>
      )}
    </div>
  )
}
