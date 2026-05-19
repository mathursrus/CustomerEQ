// Issue #423 — pure helpers for the shared filter component family. JSX-free
// so unit tests don't require a React/jsdom harness. Lifted from
// `apps/web/src/app/(admin)/admin/surveys/components/filter-chips.logic.ts`
// (Issue #241 Slice 3) — the original file is now a re-export shim until
// every consumer migrates, then it's deleted (R9c).

import {
  NPS, CSAT, CES,
  defaultScaleForType,
} from '@customerEQ/shared'

/** Adds `value` to `current` if absent; removes it if present. Returns a new array. */
export function toggleChip(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

/** Resolves the score-band chip options for a CX survey type. Empty for any
 * type outside `{NPS, CSAT, CES}` (the caller hides the chip group via
 * `shouldShowScoreBand`). */
export function bandChipsForType(type: 'NPS' | 'CSAT' | 'CES' | string): Array<{ value: string; label: string }> {
  if (type !== 'NPS' && type !== 'CSAT' && type !== 'CES') return []
  const scale = defaultScaleForType(type)
  const table =
    type === 'NPS' ? NPS.bandsForScale(scale)
    : type === 'CSAT' ? CSAT.bandsForScale(scale)
    : CES.bandsForScale(scale)
  return table.bands.map((b) => ({ value: b.key, label: b.label }))
}
