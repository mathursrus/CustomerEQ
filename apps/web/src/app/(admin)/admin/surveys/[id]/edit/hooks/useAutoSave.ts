// Issue #241 Slice 4b (#336) — Debounced per-field auto-save hook for the
// admin survey editor. Behavior per RFC §"Save behavior by state":
//   DRAFT          → triggerSave PATCHes the named field after 500ms idle.
//   ACTIVE/PAUSED  → triggerSave is a no-op (caller renders explicit Save).
//   STOPPED        → triggerSave is a no-op (read-only mode).
//
// Per-field timers (not a single shared timer) so two fields edited in the
// same debounce window each fire their own PATCH. This matches Slice 2's
// per-field audit-trail semantics — one column, one PATCH.
//
// triggerSave keeps a stable reference (useCallback []) so consumers'
// useEffect([triggerSave]) does not re-fire on every render. Mutable
// options live behind a ref the callback dereferences at fire time —
// Slice 4a Lesson 2 (reference-instability infinite-loop pattern).

import { useCallback, useEffect, useRef } from 'react'

type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'

export interface UseAutoSaveOptions {
  surveyId: string
  surveyStatus: SurveyStatus
  patchFn: (url: string, body: Record<string, unknown>) => Promise<Response>
  onSaved?: (savedAtIso: string) => void
  onError?: (err: unknown) => void
}

export interface UseAutoSaveResult {
  triggerSave: (field: string, value: unknown) => void
}

const DEBOUNCE_MS = 500

export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveResult {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const triggerSave = useCallback((field: string, value: unknown) => {
    const { surveyId, surveyStatus, patchFn, onSaved, onError } = optionsRef.current
    if (surveyStatus !== 'DRAFT') return

    const existing = timersRef.current.get(field)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      timersRef.current.delete(field)
      try {
        const res = await patchFn(`/v1/surveys/${surveyId}`, { [field]: value })
        if (!res.ok) {
          onError?.(new Error(`Auto-save failed (HTTP ${res.status})`))
          return
        }
        onSaved?.(new Date().toISOString())
      } catch (err) {
        onError?.(err)
      }
    }, DEBOUNCE_MS)

    timersRef.current.set(field, timer)
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  return { triggerSave }
}
