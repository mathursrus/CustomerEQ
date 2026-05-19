// Issue #423 — AI-derived columns caveat indicator (R6a). Reads the verbatim
// tooltip copy from the single shared `AI_FIELDS_CAVEAT` constant so the
// on-screen text and the exported workbook's row 13 disclaimer never drift.

'use client'

import { AI_FIELDS_CAVEAT } from '@customerEQ/shared'

interface AiCaveatIndicatorProps {
  /** When set, replaces the default copy. Used by the sentiment-band group's
   * inline indicator which shows a shorter sentiment-specific variant. */
  text?: string
  /** Extra class names for layout. */
  className?: string
}

export function AiCaveatIndicator({ text, className }: AiCaveatIndicatorProps) {
  return (
    <button
      type="button"
      data-testid="ai-caveat-indicator"
      aria-label="AI-derived caveat"
      title={text ?? AI_FIELDS_CAVEAT}
      className={
        className ??
        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-900 hover:bg-amber-200'
      }
    >
      i
    </button>
  )
}
