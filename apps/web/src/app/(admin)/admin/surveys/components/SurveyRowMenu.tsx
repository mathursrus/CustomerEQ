'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const [pos, setPos] = useState<{
    top: number
    left: number
    maxHeight?: number
  } | null>(null)
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

  // Recompute position when opening + on scroll/resize while open. Width is
  // measured from the live menu element (offsetWidth) so the JS doesn't encode
  // any dimension — the popover's width lives in CSS (Tailwind `w-44` below).
  // useLayoutEffect runs after DOM commit but before paint, so we can render
  // the menu invisibly, measure it, and place it with no flash.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const VIEWPORT_MARGIN = 8
    const TRIGGER_GAP = 4
    function place() {
      const trigger = triggerRef.current!.getBoundingClientRect()
      // Reset any maxHeight applied by a previous placement so offsetHeight
      // reflects the menu's *natural* size for direction selection.
      menuRef.current!.style.maxHeight = ''
      const menuW = menuRef.current!.offsetWidth
      const naturalMenuH = menuRef.current!.offsetHeight
      // Horizontal: right-align to trigger; clamp into viewport.
      const leftAligned = trigger.right - menuW
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(leftAligned, window.innerWidth - menuW - VIEWPORT_MARGIN),
      )
      // Vertical: prefer below the trigger. Flip above when the natural
      // height doesn't fit below. If neither side fits (e.g., short
      // viewport), clamp on the side with more room and let the menu
      // scroll internally so no item is unreachable.
      const spaceBelow = window.innerHeight - trigger.bottom - VIEWPORT_MARGIN - TRIGGER_GAP
      const spaceAbove = trigger.top - VIEWPORT_MARGIN - TRIGGER_GAP
      let top: number
      let maxHeight: number | undefined
      if (naturalMenuH <= spaceBelow) {
        top = trigger.bottom + TRIGGER_GAP
      } else if (naturalMenuH <= spaceAbove) {
        top = trigger.top - TRIGGER_GAP - naturalMenuH
      } else if (spaceBelow >= spaceAbove) {
        top = trigger.bottom + TRIGGER_GAP
        maxHeight = Math.max(spaceBelow, 0)
      } else {
        maxHeight = Math.max(spaceAbove, 0)
        top = trigger.top - TRIGGER_GAP - maxHeight
      }
      setPos({ top, left, maxHeight })
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
      {open && (
        <div
          ref={menuRef}
          role="menu"
          data-testid={`survey-row-menu-${surveyId}`}
          style={{
            position: 'fixed',
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            maxHeight: pos?.maxHeight,
            overflowY: pos?.maxHeight !== undefined ? 'auto' : undefined,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="w-44 z-50 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
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
