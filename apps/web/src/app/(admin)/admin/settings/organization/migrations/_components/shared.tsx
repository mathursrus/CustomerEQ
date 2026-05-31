'use client'

// Issue #524 Slice 1 — shared presentational helpers for the migration
// wizard, status panels, the Member identification section, and the brand-wide
// banner. Tailwind utilities only (the mock's CSS classes are not used).

import type { OldKeyIngress } from '@/lib/migrations'

// ───────────────────────────── ingress labels ──────────────────────────────

/** Display labels for the three tracked old-key ingress surfaces. */
export const INGRESS_LABELS: Record<OldKeyIngress, string> = {
  PUBLIC_SURVEY_RESPOND: 'Public survey responses',
  API_MEMBERS_ENROLL: 'Manual API enroll (POST /v1/members/enroll)',
  DISTRIBUTION_BATCH: 'Custom List distribution batches',
}

/** Stable display order for the per-ingress old-key table. */
export const INGRESS_ORDER: OldKeyIngress[] = [
  'PUBLIC_SURVEY_RESPOND',
  'API_MEMBERS_ENROLL',
  'DISTRIBUTION_BATCH',
]

// Human labels for the impact-preview `surface` codes (preflight-context).
const IMPACT_SURFACE_LABELS: Record<string, string> = {
  embedded_forms: 'Embedded survey forms (host application)',
  share_link: 'Share-link survey distributions',
  manual_api_enroll: 'Manual API enroll (POST /v1/members/enroll)',
  custom_list: 'Custom List distribution batches',
  outbound_webhooks: 'Outbound webhooks',
}

export function impactSurfaceLabel(surface: string): string {
  return IMPACT_SURFACE_LABELS[surface] ?? surface
}

// ───────────────────────────── time helpers ────────────────────────────────

/** Compact relative-time, e.g. "3 days ago", "12 minutes ago", "just now". */
export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  const sec = Math.round(diffMs / 1000)
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const yr = Math.round(mo / 12)
  return `${yr} year${yr === 1 ? '' : 's'} ago`
}

/** Format an ISO timestamp as a calendar date, e.g. "2026-06-26". */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(0, 10)
}

/** Whole days remaining (rounded up) until a future ISO timestamp. */
export function daysUntil(iso: string | null): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

// ───────────────────────────── stat card ───────────────────────────────────

type StatTone = 'neutral' | 'ok' | 'bad' | 'warn'

const STAT_TONE: Record<StatTone, string> = {
  neutral: 'text-gray-900',
  ok: 'text-green-600',
  bad: 'text-red-600',
  warn: 'text-amber-600',
}

export function StatCard({
  value,
  label,
  tone = 'neutral',
}: {
  value: number | string
  label: string
  tone?: StatTone
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-center">
      <div className={`text-2xl font-bold ${STAT_TONE[tone]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{children}</div>
}

// ───────────────────────────── stepper ─────────────────────────────────────

export type StepState = 'done' | 'active' | 'todo'

export function Stepper({ steps }: { steps: Array<{ label: string; state: StepState }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {steps.map((step, i) => (
        <span key={step.label} className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 ${
              step.state === 'active'
                ? 'font-semibold text-indigo-600'
                : step.state === 'done'
                  ? 'text-gray-700'
                  : 'text-gray-400'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold ${
                step.state === 'active'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : step.state === 'done'
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {step.state === 'done' ? '✓' : i + 1}
            </span>
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-gray-300" aria-hidden="true" />}
        </span>
      ))}
    </div>
  )
}

// ───────────────────────────── callout boxes ───────────────────────────────

type CalloutTone = 'info' | 'success' | 'warn' | 'danger'

const CALLOUT_TONE: Record<CalloutTone, string> = {
  info: 'border-indigo-500 bg-indigo-50 text-indigo-900',
  success: 'border-green-600 bg-green-50 text-green-900',
  warn: 'border-amber-500 bg-amber-50 text-amber-900',
  danger: 'border-red-600 bg-red-50 text-red-700',
}

export function Callout({
  tone,
  children,
}: {
  tone: CalloutTone
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md border-l-[3px] px-3.5 py-2.5 text-sm leading-relaxed ${CALLOUT_TONE[tone]}`}
    >
      {children}
    </div>
  )
}

// ───────────────────────────── badges ──────────────────────────────────────

type BadgeTone = 'success' | 'warn' | 'danger' | 'info' | 'muted'

const BADGE_TONE: Record<BadgeTone, string> = {
  success: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-indigo-100 text-indigo-700',
  muted: 'bg-gray-100 text-gray-600',
}

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  )
}

// ───────────────────────────── progress bar ────────────────────────────────

export function ProgressBar({
  value,
  total,
  done = false,
}: {
  value: number
  total: number
  done?: boolean
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2.5 overflow-hidden rounded-md bg-gray-100">
        <div
          className={`h-full ${done ? 'bg-green-600' : 'bg-indigo-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {value.toLocaleString()} of {total.toLocaleString()} members migrated
        </span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}
