// Issue #423 — shared chip-group primitive. Lifted from
// `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx`
// (Issue #241 Slice 3) and generalized for use by analytics surfaces, the
// new ResponseSection, and any successor sub-issue of #235.

'use client'

import type { ReactNode } from 'react'
import { toggleChip } from './filter-chips.logic'

export interface FilterChipGroupOption {
  value: string
  label: string
}

export interface FilterChipGroupProps {
  /** Stable id used for `data-testid` and ARIA grouping. */
  groupKey: string
  /** Display label shown to the left of the chips. */
  label: string
  /** Available chip options (rendered left-to-right). */
  options: FilterChipGroupOption[]
  /** Currently selected values. */
  selected: string[]
  /** Called with the new selection after a toggle. */
  onChange: (next: string[]) => void
  /** Optional inline helper-icon slot to the right of the label
   * (e.g., AI-caveat info-icon next to the Sentiment band group). */
  helperIcon?: ReactNode
  /** When true, suppresses inline rendering (used by FilterBar overflow). */
  hidden?: boolean
  /** When true, renders as a single-select radio group instead of multi. */
  singleSelect?: boolean
}

export function FilterChipGroup({
  groupKey,
  label,
  options,
  selected,
  onChange,
  helperIcon,
  hidden,
  singleSelect,
}: FilterChipGroupProps) {
  if (hidden || options.length === 0) return null

  function handleClick(value: string) {
    if (singleSelect) {
      onChange([value])
      return
    }
    onChange(toggleChip(selected, value))
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`filter-chip-group-${groupKey}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
        {label}
        {helperIcon}
      </span>
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            data-testid={`chip-${groupKey}-${opt.value}`}
            onClick={() => handleClick(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              active
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
