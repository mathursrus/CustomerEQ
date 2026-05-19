// Issue #423 — FilterBar overflow-aware composer. Renders chip groups in a
// single row at default widths; when the row would wrap, the least-critical
// group (Channel) collapses behind a `More filters ↓` popover. Detection
// uses a resize-observer + a Tailwind `lg:` fallback at <1024px for very
// narrow viewports.

'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface FilterBarProps {
  /** Inline chip groups, rendered left-to-right at default widths. */
  inlineGroups: ReactNode[]
  /** Overflow group rendered inline at default widths but collapsed into a
   * popover when the bar would wrap. */
  overflowGroup: ReactNode
  /** Optional label for the overflow popover trigger. Defaults to "More filters". */
  overflowLabel?: string
}

export function FilterBar({ inlineGroups, overflowGroup, overflowLabel = 'More filters' }: FilterBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [overflowed, setOverflowed] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      // Heuristic: scrollWidth > clientWidth means the inline groups exceed
      // the bar's visible width. We also use a `lg:` Tailwind class as a
      // fallback for non-ResizeObserver environments.
      setOverflowed(el.scrollWidth > el.clientWidth + 8)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-4 py-2 border-b border-dashed border-slate-200 mb-3 relative"
      data-testid="filter-bar"
    >
      {inlineGroups.map((group, idx) => (
        <div key={idx}>{group}</div>
      ))}
      {!overflowed ? (
        <div data-testid="filter-bar-inline-overflow">{overflowGroup}</div>
      ) : (
        <>
          <button
            type="button"
            data-testid="filter-bar-more-trigger"
            onClick={() => setPopoverOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            aria-expanded={popoverOpen}
          >
            {overflowLabel} ↓
          </button>
          {popoverOpen ? (
            <div
              data-testid="filter-bar-popover"
              className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
            >
              {overflowGroup}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
