// Issue #420 — Status chip vocabulary + color tokens for the audience-builder
// list rows. Single source of truth so the inline search-result pill and the
// accumulated-list Status column render the exact same chip per state.
// Verbiage + colors mirror docs/feature-specs/mocks/420-send-via-customereq-acs.html
// lines 432-499 (Scene 2) and lines 596-599 (Scene 2B).

import type { SurveySuppressionStatus } from '@customerEQ/shared'

export interface SuppressionChipStyle {
  bg: string
  text: string
  label: string
  /** Whether selection is disabled for rows with this status (R22). */
  disabled: boolean
}

/**
 * Resolve the chip style for a row's `suppressionStatus` + optional `since`
 * date. `since` is rendered into the UNSUBSCRIBED label so the operator sees
 * when the member opted out (matches mock line 491: "⚠ Unsubscribed · 2026-04-12").
 */
export function suppressionChipStyle(
  status: SurveySuppressionStatus,
  since: string | null | undefined,
): SuppressionChipStyle {
  switch (status) {
    case 'OK':
      return { bg: 'bg-green-50', text: 'text-green-700', label: 'OK', disabled: false }
    case 'UNSUBSCRIBED': {
      const date = since ? since.slice(0, 10) : null
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: date ? `⚠ Unsubscribed · ${date}` : '⚠ Unsubscribed',
        disabled: true,
      }
    }
    case 'NO_CONSENT':
      return { bg: 'bg-amber-50', text: 'text-amber-700', label: '⚠ No consent', disabled: true }
    case 'ERASED':
      return { bg: 'bg-rose-50', text: 'text-rose-700', label: '⚠ Erased', disabled: true }
    case 'NO_EMAIL':
      return { bg: 'bg-amber-50', text: 'text-amber-700', label: '⚠ No email', disabled: true }
  }
}
