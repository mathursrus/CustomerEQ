// Issue #420 — Existing Members > Search tab.
// Wildcard glob query (R17), 25/50 pagination (R20), multi-select rows,
// explicit "Add N members" CTA (mirroring R18's discipline). Suppressed
// rows render with disabled Add checkbox + the inline suppression pill so
// the operator sees who can't be reached BEFORE adding (mock §2.2 R6 detail).

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

import { API_URL, getAuthToken } from '@/lib/config'
import { suppressionChipStyle } from './suppressionChips'
import type { AudienceRow, MembersSearchResponse } from './types'

interface SearchTabProps {
  alreadyAddedKeys: Set<string>
  onAddRows: (rows: AudienceRow[]) => void
}

export function SearchTab({ alreadyAddedKeys, onAddRows }: SearchTabProps) {
  const { getToken } = useAuth()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<25 | 50>(25)
  const [results, setResults] = useState<MembersSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!submittedQuery) {
      setResults(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const token = await getAuthToken(getToken)
        if (!token) {
          setError('Not authenticated.')
          return
        }
        const url = new URL(`${API_URL}/v1/members`)
        url.searchParams.set('q', submittedQuery)
        url.searchParams.set('page', String(page))
        url.searchParams.set('pageSize', String(pageSize))
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          setError(`Search failed (${res.status})`)
          return
        }
        const data = (await res.json()) as MembersSearchResponse
        if (!cancelled) setResults(data)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [submittedQuery, page, pageSize, getToken])

  const handleSearch = () => {
    setPage(1)
    setSelectedIds(new Set())
    setSubmittedQuery(query.trim())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableRows = (results?.data ?? []).filter(
    (m) =>
      m.suppressionStatus === 'OK' &&
      !alreadyAddedKeys.has(m.id) &&
      !alreadyAddedKeys.has(m.externalId.toLowerCase()),
  )
  const allSelectableSelected =
    selectableRows.length > 0 && selectableRows.every((m) => selectedIds.has(m.id))

  const handleAddSelected = () => {
    if (!results) return
    const rows = results.data
      .filter((m) => selectedIds.has(m.id) && m.suppressionStatus === 'OK')
      .map<AudienceRow>((m) => ({
        memberId: m.id,
        identifier: m.externalId,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        lastResponseThisSurvey: null,
        source: 'EXISTING_SEARCH',
        willAutoEnroll: false,
        suppressionStatus: m.suppressionStatus,
        suppressionSince: m.suppressionSince,
        selected: true,
      }))
    if (rows.length === 0) return
    onAddRows(rows)
    setSelectedIds(new Set())
  }

  const handleAddAllOnPage = () => {
    if (!results) return
    const rows = selectableRows.map<AudienceRow>((m) => ({
      memberId: m.id,
      identifier: m.externalId,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      lastResponseThisSurvey: null,
      source: 'EXISTING_SEARCH',
      willAutoEnroll: false,
      suppressionStatus: m.suppressionStatus,
      suppressionSince: m.suppressionSince,
      selected: true,
    }))
    if (rows.length === 0) return
    onAddRows(rows)
    setSelectedIds(new Set())
  }

  const totalSuppressedOnPage =
    (results?.data ?? []).filter((m) => m.suppressionStatus !== 'OK').length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          placeholder="email · name · external id … wildcards: *@artistos.com, q2-*, *support*"
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          aria-label="Search members"
        />
        <button
          type="button"
          onClick={handleSearch}
          aria-label="Run search"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <span aria-hidden="true">🔍</span>
          Search
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="text-xs text-gray-500">Searching…</p>}

      {results && !loading && (
        <>
          {results.data.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
              No members match <code className="rounded bg-gray-100 px-1">{submittedQuery}</code>.
            </p>
          ) : (
            <>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="w-8 px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select all eligible on page"
                          checked={allSelectableSelected}
                          onChange={() => {
                            if (allSelectableSelected) {
                              setSelectedIds(new Set())
                            } else {
                              setSelectedIds(new Set(selectableRows.map((m) => m.id)))
                            }
                          }}
                        />
                      </th>
                      <th className="px-2 py-2 font-medium text-gray-700">Name</th>
                      <th className="px-2 py-2 font-medium text-gray-700">Identifier</th>
                      <th className="px-2 py-2 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.map((m) => {
                      const isAlreadyAdded =
                        alreadyAddedKeys.has(m.id) ||
                        alreadyAddedKeys.has(m.externalId.toLowerCase())
                      const chip = suppressionChipStyle(m.suppressionStatus, m.suppressionSince)
                      const disabled = chip.disabled || isAlreadyAdded
                      const name =
                        [m.firstName, m.lastName].filter(Boolean).join(' ') || '—'
                      return (
                        <tr
                          key={m.id}
                          className={`border-t border-gray-100 ${disabled ? 'opacity-60' : ''}`}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Select ${name}`}
                              disabled={disabled}
                              checked={selectedIds.has(m.id)}
                              onChange={() => toggleSelect(m.id)}
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-900">{name}</td>
                          <td className="px-2 py-2 font-mono text-gray-700">
                            {m.email ?? m.externalId}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.bg} ${chip.text}`}
                            >
                              {isAlreadyAdded ? 'Added' : chip.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                <span>
                  Showing {results.data.length} of {results.total.toLocaleString()} matches
                  {totalSuppressedOnPage > 0 && (
                    <span className="ml-1 text-amber-700">
                      · {totalSuppressedOnPage} suppressed on this page
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value) as 25 | 50)
                      setPage(1)
                    }}
                    aria-label="Page size"
                    className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <span>
                    {page} / {Math.max(1, results.totalPages)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(results.totalPages, p + 1))}
                    disabled={page >= results.totalPages}
                    className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedIds.size === 0}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add {selectedIds.size} selected members
                </button>
                <button
                  type="button"
                  onClick={handleAddAllOnPage}
                  disabled={selectableRows.length === 0}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Add all on page ({selectableRows.length} eligible)
                </button>
              </div>
            </>
          )}
        </>
      )}

      {!results && !loading && (
        <p className="text-xs text-gray-500">
          Type a search and press Enter (or click Search). Wildcards{' '}
          <code className="rounded bg-gray-100 px-1">*</code> and{' '}
          <code className="rounded bg-gray-100 px-1">?</code> are supported.
        </p>
      )}
    </div>
  )
}
