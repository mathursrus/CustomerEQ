'use client'

import { toggleChip } from './filter-chips.logic'

// Issue #241 Slice 3 — chip-style filter UI for the surveys list per spec §1
// ("Filter chips at the top: Status and Type"). Multi-select within group,
// intersect across groups. Self-contained; no external dropdown primitive
// required. Pure toggle logic lives in filter-chips.logic.ts for testing.

export interface ChipGroup {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
}

interface FilterChipsProps {
  groups: ChipGroup[]
  /** Selected values per group key — { status: ['DRAFT', 'ACTIVE'], type: ['NPS'] } */
  selected: Record<string, string[]>
  onChange: (groupKey: string, values: string[]) => void
}

export function FilterChips({ groups, selected, onChange }: FilterChipsProps) {
  function toggle(groupKey: string, value: string) {
    onChange(groupKey, toggleChip(selected[groupKey] ?? [], value))
  }

  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="filter-chips">
      {groups.map((group) => {
        const groupSel = selected[group.key] ?? []
        return (
          <div key={group.key} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </span>
            {group.options.map((opt) => {
              const active = groupSel.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  data-testid={`chip-${group.key}-${opt.value}`}
                  onClick={() => toggle(group.key, opt.value)}
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
      })}
    </div>
  )
}
