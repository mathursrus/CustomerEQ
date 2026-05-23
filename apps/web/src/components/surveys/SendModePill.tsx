'use client'

// Issue #420 — shared send-mode pill. Used in:
//   - LoopMonitor (Survey Sent drawer breakdown — R39)
//   - Wave Detail page top-of-page pill (R-Wave-Detail)
//   - Configuration Summary / batch-filter rows (existing surfaces)
// Mirrors the spec mock pill classes `mode-managed-acs` and `mode-self-serve`.

type SendMode = 'MANAGED_EMAIL' | 'SELF_SERVE'

const VARIANTS: Record<SendMode, { label: string; className: string }> = {
  MANAGED_EMAIL: {
    label: 'Managed',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  SELF_SERVE: {
    label: 'Self-serve',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

export function SendModePill({
  mode,
  size = 'sm',
}: {
  mode: SendMode
  size?: 'sm' | 'md'
}) {
  const v = VARIANTS[mode]
  const sizeClass =
    size === 'md'
      ? 'text-xs px-2 py-0.5'
      : 'text-[10px] px-1.5 py-0.5'
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${v.className}`}
      data-testid={`send-mode-pill-${mode}`}
    >
      {v.label}
    </span>
  )
}
