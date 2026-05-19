// Issue #423 — pagination footer for the Response table (R11, R12). The
// page-size selector emits only the UI-tier values (25/50/100); the parent
// owns sessionStorage persistence + reset-to-25 on full reload.

'use client'

export interface ResponsePaginationProps {
  page: number
  pageSize: 25 | 50 | 100
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: 25 | 50 | 100) => void
}

export function ResponsePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ResponsePaginationProps) {
  return (
    <div className="flex items-center justify-between pt-3 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <span>Page size:</span>
        <select
          aria-label="Page size"
          data-testid="response-page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as 25 | 50 | 100)}
          className="rounded border border-slate-300 px-2 py-1 text-xs"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="response-page-prev"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span data-testid="response-page-info" className="px-2 text-xs text-slate-700">
          Page {page} of {totalPages} · {total.toLocaleString()} responses
        </span>
        <button
          type="button"
          data-testid="response-page-next"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
