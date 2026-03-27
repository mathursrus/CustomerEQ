'use client'

import { type ReactNode } from 'react'

export interface Column<T extends object> {
  key: string
  label: string
  render?: (row: T) => ReactNode
}

interface PaginatedTableProps<T extends object> {
  columns: Column<T>[]
  data: T[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onRowDoubleClick?: (row: T) => void
  renderRowActions?: (row: T) => ReactNode
  emptyMessage?: ReactNode
  testId?: string
}

export function PaginatedTable<T extends object>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRowDoubleClick,
  renderRowActions,
  emptyMessage,
  testId,
}: PaginatedTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table data-testid={testId} className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {col.label}
                  </th>
                ))}
                {renderRowActions && <th className="px-6 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (renderRowActions ? 1 : 0)}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    {emptyMessage ?? 'No records found.'}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50 ${onRowDoubleClick ? 'cursor-pointer select-none' : ''}`}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4 text-gray-700">
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}
                    {renderRowActions && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {renderRowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="text-xs">
          {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
        </span>
        <div className="flex items-center gap-3">
          {onPageSizeChange && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value))
                  onPageChange(1)
                }}
                className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="min-w-20 text-center text-xs">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
