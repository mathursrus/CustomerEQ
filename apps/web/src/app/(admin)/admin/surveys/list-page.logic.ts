// Issue #241 Slice 3 — pure helpers for the surveys list page.
// JSX-free so tests don't need a React/jsdom harness. The React shell
// (page.tsx) imports from here.
//
// Issue #423 R9c — the chip-group primitive lives in
// `apps/web/src/components/filters/FilterChipGroup.tsx`; this file holds the
// surveys-list-specific group configuration only.

export interface ChipGroupConfig {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
}

// Filter chip groups per spec §1.
// Status: All / Draft / Active / Stopped — NO Paused (admins reach paused
// surveys via the unfiltered "All" view, per spec §1).
export const STATUS_GROUP: ChipGroupConfig = {
  key: 'status',
  label: 'Status',
  options: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'STOPPED', label: 'Stopped' },
  ],
}

// Type: NPS / CSAT / CES / Custom — NO Trigger or Distribution chips per
// spec §1 (CustomerEQ doesn't natively trigger surveys in V0; distribution
// is multi-channel, not categorical).
export const TYPE_GROUP: ChipGroupConfig = {
  key: 'type',
  label: 'Type',
  options: [
    { value: 'NPS', label: 'NPS' },
    { value: 'CSAT', label: 'CSAT' },
    { value: 'CES', label: 'CES' },
    { value: 'CUSTOM', label: 'Custom' },
  ],
}

export const TYPE_PILL: Record<string, string> = {
  NPS: 'bg-indigo-100 text-indigo-700',
  CSAT: 'bg-blue-100 text-blue-700',
  CES: 'bg-purple-100 text-purple-700',
  CUSTOM: 'bg-slate-100 text-slate-600',
}

// Relative time for the Updated column. Accepts an ISO string + optional
// reference Date (defaults to Date.now()). Reference is injectable so tests
// don't depend on the clock.
export function relTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
