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
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    <div ref={wrapRef} className="relative inline-block text-left">
      <button
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
          role="menu"
          data-testid={`survey-row-menu-${surveyId}`}
          className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
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
    </div>
  )
}
