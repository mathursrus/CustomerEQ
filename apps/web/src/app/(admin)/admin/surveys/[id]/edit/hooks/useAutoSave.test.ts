// Issue #241 Slice 4b (#336) — useAutoSave hook contract.
//
// Behavioral contract this test pins down (RFC §"Save behavior by state"):
//   1. DRAFT  → PATCH /v1/surveys/:id on blur, debounced 500ms, one field per call.
//   2. ACTIVE / PAUSED / STOPPED → no PATCH (short-circuit). Caller renders an
//      explicit Save button instead.
//   3. Rapid edits to the same field collapse into the last value (one PATCH).
//   4. Two distinct fields edited inside the same debounce window each produce
//      their own PATCH (no batching across fields — keeps the audit trail clean
//      per Slice 2's per-field semantics).
//   5. Unmounting cancels any pending timers (no stray PATCH after unmount).
//   6. After a successful PATCH the hook invokes the onSaved callback with the
//      ISO timestamp the indicator uses for "Saved · Xs ago".
//
// Implementation note for Phase 4: the hook returns a stable triggerSave fn
// (useCallback) so consumers' useEffect([triggerSave]) does not re-fire and
// loop (Slice 4a Lesson 2: reference instability bug pattern).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useAutoSave } from './useAutoSave'

const SURVEY_ID = 'srv_test_4b_autosave'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutoSave hook (#336 Slice 4b)', () => {
  it('PATCHes a single field after 500ms in DRAFT status', async () => {
    const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const onSaved = vi.fn()
    const { result } = renderHook(() =>
      useAutoSave({ surveyId: SURVEY_ID, surveyStatus: 'DRAFT', patchFn, onSaved }),
    )

    act(() => {
      result.current.triggerSave('title', 'Quick check-in')
    })

    // Before debounce window, no PATCH.
    expect(patchFn).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(patchFn).toHaveBeenCalledTimes(1)
    expect(patchFn).toHaveBeenCalledWith(`/v1/surveys/${SURVEY_ID}`, { title: 'Quick check-in' })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it.each(['ACTIVE', 'PAUSED', 'STOPPED'] as const)(
    'short-circuits (no PATCH) when surveyStatus=%s — explicit Save button path',
    async (status) => {
      const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
      const onSaved = vi.fn()
      const { result } = renderHook(() =>
        useAutoSave({ surveyId: SURVEY_ID, surveyStatus: status, patchFn, onSaved }),
      )

      act(() => {
        result.current.triggerSave('title', 'Should not save')
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      expect(patchFn).not.toHaveBeenCalled()
      expect(onSaved).not.toHaveBeenCalled()
    },
  )

  it('rapid edits to the same field collapse into one PATCH with the last value', async () => {
    const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const { result } = renderHook(() =>
      useAutoSave({ surveyId: SURVEY_ID, surveyStatus: 'DRAFT', patchFn, onSaved: () => {} }),
    )

    act(() => {
      result.current.triggerSave('title', 'A')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    act(() => {
      result.current.triggerSave('title', 'AB')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    act(() => {
      result.current.triggerSave('title', 'ABC')
    })

    // Each new call resets the timer — let the FULL debounce elapse from the
    // last edit before asserting.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(patchFn).toHaveBeenCalledTimes(1)
    expect(patchFn).toHaveBeenCalledWith(`/v1/surveys/${SURVEY_ID}`, { title: 'ABC' })
  })

  it('edits to two distinct fields produce two PATCHes (no cross-field batching)', async () => {
    const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const { result } = renderHook(() =>
      useAutoSave({ surveyId: SURVEY_ID, surveyStatus: 'DRAFT', patchFn, onSaved: () => {} }),
    )

    act(() => {
      result.current.triggerSave('title', 'Quick check-in')
      result.current.triggerSave('description', 'A loyalty NPS')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(patchFn).toHaveBeenCalledTimes(2)
    const bodies = patchFn.mock.calls.map((c) => c[1])
    expect(bodies).toContainEqual({ title: 'Quick check-in' })
    expect(bodies).toContainEqual({ description: 'A loyalty NPS' })
  })

  it('cancels pending PATCH on unmount (no stray network call)', async () => {
    const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const { result, unmount } = renderHook(() =>
      useAutoSave({ surveyId: SURVEY_ID, surveyStatus: 'DRAFT', patchFn, onSaved: () => {} }),
    )

    act(() => {
      result.current.triggerSave('title', 'About to unmount')
    })

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(patchFn).not.toHaveBeenCalled()
  })

  it('invokes onError when the PATCH fails so the indicator can surface the error', async () => {
    const patchFn = vi.fn(async () => new Response('Bad Request', { status: 400 }))
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useAutoSave({
        surveyId: SURVEY_ID,
        surveyStatus: 'DRAFT',
        patchFn,
        onSaved: () => {},
        onError,
      }),
    )

    act(() => {
      result.current.triggerSave('title', 'Will fail')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(patchFn).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('triggerSave keeps a stable reference across re-renders (Slice 4a Lesson 2)', () => {
    const patchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const { result, rerender } = renderHook(
      ({ status }: { status: 'DRAFT' | 'ACTIVE' }) =>
        useAutoSave({ surveyId: SURVEY_ID, surveyStatus: status, patchFn, onSaved: () => {} }),
      { initialProps: { status: 'DRAFT' as const } },
    )

    const firstRef = result.current.triggerSave
    rerender({ status: 'DRAFT' as const })
    expect(result.current.triggerSave).toBe(firstRef)
  })
})
