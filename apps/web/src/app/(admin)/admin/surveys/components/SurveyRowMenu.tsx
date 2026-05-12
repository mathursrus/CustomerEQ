'use client'

import { useEffect, useRef, useState } from 'react'
import {
  buildMenuItems,
  type ApiCaller,
  type MenuItem,
  type SurveyState,
} from './survey-row-menu.logic'

// Issue #241 Slice 3 — state-aware ⋯ row menu per spec §1.
// Pure state→items logic lives in survey-row-menu.logic.ts (tested separately);
// this file is the React shell — popover, click-outside, confirm-dialog, busy state.
//
// Popover positioning uses `position: fixed` with coordinates from the trigger's
// getBoundingClientRect(). This escapes the table's `overflow-x-auto` ancestor
// clipping (which caused issue: on the last row the menu was clipped and the
// browser added a horizontal scrollbar). Fixed positioning is relative to the
// viewport, not the table.

export type { SurveyState } from './survey-row-menu.logic'

const MENU_WIDTH = 176 // matches w-44

interface SurveyRowMenuProps {
  surveyId: string
  state: SurveyState
  surveyName: string
  onActionComplete: () => void
  onActionError?: (message: string) => void
  callApi: ApiCaller
}

export function SurveyRowMenu({
  surveyId,
  state,
  surveyName,
  onActionComplete,
  onActionError,
  callApi,
}: SurveyRowMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (
        triggerRef.current && triggerRef.current.contains(t)
      ) return
      if (menuRef.current && menuRef.current.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Recompute position when opening + on scroll/resize while open.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    function place() {
      const r = triggerRef.current!.getBoundingClientRect()
      // Right-align to the trigger button. Clamp into viewport so the
      // menu never overflows the right edge (e.g., on narrow viewports).
      const right = r.right
      const leftAligned = right - MENU_WIDTH
      const left = Math.max(8, Math.min(leftAligned, window.innerWidth - MENU_WIDTH - 8))
      setPos({ top: r.bottom + 4, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const items = buildMenuItems(callApi).filter((i) => i.visible(state))

  async function handleClick(item: MenuItem) {
    if (item.confirm) {
      const ok = window.confirm(item.confirm(surveyName))
      if (!ok) return
    }
    setBusy(true)
    setOpen(false)
    try {
      const res = await item.action(surveyId)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
        onActionError?.(data.message ?? data.error ?? `Action failed (HTTP ${res.status})`)
      } else {
        onActionComplete()
      }
    } catch (err) {
      onActionError?.(err instanceof Error ? err.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`survey-row-menu-trigger-${surveyId}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        disabled={busy}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        ⋯
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          data-testid={`survey-row-menu-${surveyId}`}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="z-50 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              data-testid={`survey-row-menu-item-${item.key}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleClick(item)
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
