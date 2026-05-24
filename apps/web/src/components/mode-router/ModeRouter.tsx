'use client'

// Issue #420 — generic mode-router primitive for routes that present multiple
// flows sharing a parent URL, distinguished by a `?mode=` query parameter.
//
// First consumer: /admin/surveys/[id]/distribute (self-serve | managed-email).
// The primitive is lifted here at first usage on the reviewer's instruction —
// once a second consumer surfaces, this file already owns the cross-cutting
// concerns (URL parsing, default-mode fallback, switchTo helper, render-of-
// active-flow, context for in-flow mode awareness) so the second consumer is
// a one-line change instead of a copy-paste.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  type ComponentType,
  createContext,
  type ReactElement,
  useCallback,
  useContext,
  useMemo,
} from 'react'

interface ModeRouterContextValue<TMode extends string> {
  currentMode: TMode
  switchTo: (mode: TMode) => void
  modes: readonly TMode[]
}

const ModeRouterContext = createContext<ModeRouterContextValue<string> | null>(null)

export interface ModeRouterProps<TMode extends string> {
  modes: Record<TMode, ComponentType>
  defaultMode: TMode
  paramName?: string
}

export function ModeRouter<TMode extends string>(
  props: ModeRouterProps<TMode>,
): ReactElement {
  const { modes, defaultMode, paramName = 'mode' } = props
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const requested = searchParams.get(paramName) as TMode | null
  const currentMode: TMode =
    requested !== null && Object.prototype.hasOwnProperty.call(modes, requested)
      ? requested
      : defaultMode

  const switchTo = useCallback(
    (next: TMode) => {
      const params = new URLSearchParams(searchParams.toString())
      // When switching to the default mode, omit the param entirely so the URL
      // is the canonical bookmarkable shape (R5: bookmarked URL with no ?mode=
      // resolves to the default flow).
      if (next === defaultMode) {
        params.delete(paramName)
      } else {
        params.set(paramName, next)
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [defaultMode, paramName, pathname, router, searchParams],
  )

  const value = useMemo<ModeRouterContextValue<TMode>>(
    () => ({
      currentMode,
      switchTo,
      // The Object.keys() narrowing is wider than TS can see at the generic
      // site; the cast pairs with the `modes` prop's Record<TMode, …> shape
      // so the runtime list matches the static type by construction.
      modes: Object.keys(modes) as unknown as readonly TMode[],
    }),
    [currentMode, switchTo, modes],
  )

  const Active: ComponentType = modes[currentMode]

  return (
    <ModeRouterContext.Provider value={value as unknown as ModeRouterContextValue<string>}>
      <Active />
    </ModeRouterContext.Provider>
  )
}

export function useModeRouter<TMode extends string = string>(): ModeRouterContextValue<TMode> {
  const ctx = useContext(ModeRouterContext)
  if (ctx === null) {
    throw new Error('useModeRouter must be called inside a <ModeRouter> tree.')
  }
  return ctx as unknown as ModeRouterContextValue<TMode>
}
