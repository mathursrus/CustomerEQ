// Issue #241 Slice 4a — state-aware More menu in the detail header.
// Reuses Slice 3's survey-row-menu.logic so the visibility matrix doesn't drift.

'use client'

import { useEffect, useRef, useState } from 'react'

import {
  buildMenuItems,
  type SurveyState,
} from '@/app/(admin)/admin/surveys/components/survey-row-menu.logic'

export interface SurveyDetailMoreMenuProps {
  surveyId: string
  surveyName: string
  state: SurveyState
  callApi: (path: string, init?: { method?: string; body?: unknown }) => Promise<Response>
  onActionComplete: () => void
}

export function SurveyDetailMoreMenu({
  surveyId,
  surveyName,
  state,
  callApi,
  onActionComplete,
}: SurveyDetailMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const items = buildMenuItems(callApi).filter((item) => item.visible(state))

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!buttonRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function runItem(item: ReturnType<typeof buildMenuItems>[number]) {
    if (busy) return
    if (item.confirm && !window.confirm(item.confirm(surveyName))) return
    setBusy(true)
    try {
      await item.action(surveyId)
      onActionComplete()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        More ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No actions available in this state.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => runItem(item)}
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
