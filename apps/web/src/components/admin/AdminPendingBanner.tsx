'use client'

// Issue #292 Slice 4 — shared admin component for cross-section required-field
// surfacing. Reusable across future settings pages (R16). Data-state-driven —
// no Dismiss / Snooze affordance per spec §"Banner with Dismiss / Snooze".

export interface AdminPendingItem {
  field: string
  label: string
  consequence: string
  jumpToSectionId: string
}

interface AdminPendingBannerProps {
  items: AdminPendingItem[]
}

export function AdminPendingBanner({ items }: AdminPendingBannerProps) {
  if (items.length === 0) return null

  const headline =
    items.length === 1
      ? 'Action needed — 1 setting incomplete'
      : `Action needed — ${items.length} settings incomplete`

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 border-l-[3px] border-l-amber-500 bg-amber-50 px-4 py-3"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
      >
        !
      </span>
      <div className="flex-1">
        <h3 className="m-0 mb-1.5 text-sm font-semibold text-amber-900">{headline}</h3>
        <ul className="m-0 flex flex-col gap-1 p-0">
          {items.map((item) => (
            <li
              key={item.field}
              className="flex list-none items-start justify-between gap-3 text-sm leading-snug text-amber-900"
            >
              <span className="flex-1">
                <strong className="font-semibold">{item.label}</strong> {item.consequence}
              </span>
              <a
                href={`#${item.jumpToSectionId}`}
                className="shrink-0 whitespace-nowrap rounded border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium text-amber-900 no-underline hover:border-amber-500 hover:bg-amber-500 hover:text-white"
              >
                Jump to section →
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
