// Issue #420 — Accumulated audience list (R22/R23/R20).
// - Per-row checkbox (operator can deselect/re-select) except suppressed
//   rows where the checkbox is unchecked AND disabled (R22).
// - Status chip column rendering OK / Unsubscribed · date / No consent /
//   Erased / No email; suppressed rows render at 60% opacity with a
//   tooltip explaining why (matches mock §2.2 R6 detail).
// - 25/50 pagination select + per-page bulk actions: Select all on page,
//   Deselect all on page, Remove all unchecked.

'use client'

import { useState } from 'react'

import { suppressionTooltip } from '@customerEQ/shared'
import { suppressionChipStyle } from './suppressionChips'
import type { AudienceRow } from './types'

interface AudienceListProps {
  rows: AudienceRow[]
  onToggleRow: (key: string) => void
  onBulkSelectPage: (keys: string[], select: boolean) => void
  onRemoveUnchecked: () => void
}

const rowKey = (r: AudienceRow): string =>
  r.memberId ?? r.identifier.toLowerCase()

export function AudienceList({
  rows,
  onToggleRow,
  onBulkSelectPage,
  onRemoveUnchecked,
}: AudienceListProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<25 | 50>(25)

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageSelectableRows = pageRows.filter(
    (r) => r.suppressionStatus === 'OK',
  )
  const allSelected =
    pageSelectableRows.length > 0 &&
    pageSelectableRows.every((r) => r.selected)

  const selectedCount = rows.filter((r) => r.selected).length
  const suppressedCount = rows.filter(
    (r) => r.suppressionStatus !== 'OK',
  ).length
  const willAutoEnrollCount = rows.filter(
    (r) => r.willAutoEnroll && r.suppressionStatus === 'OK',
  ).length
  const deselectedCount =
    rows.length - selectedCount - suppressedCount

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
        <p className="text-sm font-medium text-gray-700">No members added yet.</p>
        <p className="mt-1 text-xs text-gray-500">
          Use the cards above to add members from your roster or paste a list.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="text-sm text-gray-900">
          <strong>
            {rows.length} {rows.length === 1 ? 'member' : 'members'} in this wave
          </strong>{' '}
          <span className="text-xs text-gray-600">
            · {selectedCount} selected
            {willAutoEnrollCount > 0 && ` · ${willAutoEnrollCount} will auto-enroll`}
            {deselectedCount > 0 && ` · ${deselectedCount} deselected`}
            {suppressedCount > 0 && ` · ${suppressedCount} suppressed (excluded)`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() =>
              onBulkSelectPage(
                pageSelectableRows.map((r) => rowKey(r)),
                true,
              )
            }
            disabled={pageSelectableRows.length === 0}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40"
          >
            Select all on page
          </button>
          <button
            type="button"
            onClick={() =>
              onBulkSelectPage(
                pageSelectableRows.map((r) => rowKey(r)),
                false,
              )
            }
            disabled={pageSelectableRows.length === 0}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40"
          >
            Deselect all on page
          </button>
          <button
            type="button"
            onClick={onRemoveUnchecked}
            disabled={deselectedCount === 0}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            Remove all unchecked
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all eligible on page"
                  checked={allSelected}
                  onChange={() =>
                    onBulkSelectPage(
                      pageSelectableRows.map((r) => rowKey(r)),
                      !allSelected,
                    )
                  }
                  disabled={pageSelectableRows.length === 0}
                />
              </th>
              <th className="px-3 py-2 font-medium text-gray-700">Name</th>
              <th className="px-3 py-2 font-medium text-gray-700">Identifier</th>
              <th className="px-3 py-2 font-medium text-gray-700">Source</th>
              {/* G22 — pre-#420 spec surfaced these two columns; restored here. */}
              <th className="px-3 py-2 font-medium text-gray-700">Last response (this survey)</th>
              <th className="px-3 py-2 font-medium text-gray-700">Last response (any survey)</th>
              <th className="px-3 py-2 font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const chip = suppressionChipStyle(r.suppressionStatus, r.suppressionSince)
              const disabled = chip.disabled
              const name =
                [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || '—'
              const tooltip = disabled
                ? suppressionTooltip(
                    { firstName: r.firstName, lastName: r.lastName, identifier: r.identifier },
                    { status: r.suppressionStatus, since: r.suppressionSince },
                  )
                : undefined
              return (
                <tr
                  key={rowKey(r)}
                  title={tooltip}
                  className={`border-t border-gray-100 ${disabled ? 'opacity-60' : ''}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${name}`}
                      checked={r.selected}
                      disabled={disabled}
                      onChange={() => onToggleRow(rowKey(r))}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-900">{name}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">
                    {r.email ?? r.identifier}
                  </td>
                  <td className="px-3 py-2">
                    <SourceChip row={r} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">{formatResponseDate(r.lastResponseThisSurvey)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatResponseDate(r.lastResponseAnySurvey)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.bg} ${chip.text}`}
                    >
                      {chip.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
        <span>
          Page {safePage} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}

// G22 — short date format for the "Last response" columns. Browser-locale,
// no timezone bind (the audience-builder isn't a deadline surface where
// brand-timezone precision matters — the operator just needs "did this
// person respond recently"). Em-dash when the field is null/undefined.
function formatResponseDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return '—'
  }
}

function SourceChip({ row }: { row: AudienceRow }) {
  if (row.willAutoEnroll) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        New (auto-enroll)
      </span>
    )
  }
  if (row.source === 'CUSTOM_LIST') {
    return (
      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
        Existing · pasted
      </span>
    )
  }
  if (row.source === 'EXISTING_RANDOM') {
    return (
      <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
        Existing · random
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
      Existing
    </span>
  )
}
