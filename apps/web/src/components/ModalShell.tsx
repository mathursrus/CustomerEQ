'use client'

import type { ReactNode } from 'react'

// Shared modal dialog wrapper for the admin UI.
// Standardizes role="dialog" + aria-modal + backdrop color + z-index + centering
// so individual modal components only have to supply their own inner content.
// Consolidated from 4 Slice 4b call sites (Q8-003 / Q8-004 — Phase 8 quality fix).
// Backdrop is bg-gray-900/50 (most-common choice across existing modals).

export interface ModalShellProps {
  open: boolean
  /** Use when the modal has its own heading element to label from. */
  ariaLabelledBy?: string
  /** Use when there's no in-DOM heading; supply the label inline. */
  ariaLabel?: string
  children: ReactNode
}

export function ModalShell({ open, ariaLabelledBy, ariaLabel, children }: ModalShellProps) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
    >
      {children}
    </div>
  )
}
