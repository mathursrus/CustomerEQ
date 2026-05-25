import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { usePollingQuery } from './usePollingQuery'

describe('usePollingQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches immediately on mount when enabled', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ count: 1 })
    const { result } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 1_000 }),
    )

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.data).toEqual({ count: 1 })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('repeats the fetch at intervalMs cadence', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ tick: 1 })
      .mockResolvedValueOnce({ tick: 2 })
      .mockResolvedValueOnce({ tick: 3 })

    const { result } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 2_000 }),
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.data).toEqual({ tick: 1 })

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ tick: 2 })

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(result.current.data).toEqual({ tick: 3 })
  })

  it('does not fetch when enabled is false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true })

    const { result } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 1_000, enabled: false }),
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('starts polling when enabled flips false → true', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true })

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePollingQuery({ fetchFn, intervalMs: 1_000, enabled }),
      { initialProps: { enabled: false } },
    )

    expect(fetchFn).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({ ok: true })
  })

  it('stops polling when enabled flips true → false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true })

    const { rerender } = renderHook(
      ({ enabled }) =>
        usePollingQuery({ fetchFn, intervalMs: 1_000, enabled }),
      { initialProps: { enabled: true } },
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    const callCountAfterFirstTick = fetchFn.mock.calls.length

    rerender({ enabled: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })

    expect(fetchFn.mock.calls.length).toBe(callCountAfterFirstTick)
  })

  it('surfaces fetch errors and clears them on next success', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 1_000 }),
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.error?.message).toBe('boom')
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({ ok: true })
  })

  it('refetch() triggers an out-of-band fetch', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 })

    const { result } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 60_000 }),
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.data).toEqual({ v: 1 })

    await act(async () => {
      await result.current.refetch()
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ v: 2 })
  })

  it('does not setState after unmount', async () => {
    let resolve: (value: { ok: true }) => void = () => undefined
    const pending = new Promise<{ ok: true }>((r) => {
      resolve = r
    })
    const fetchFn = vi.fn().mockReturnValue(pending)

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { unmount } = renderHook(() =>
      usePollingQuery({ fetchFn, intervalMs: 1_000 }),
    )

    unmount()
    await act(async () => {
      resolve({ ok: true })
      await pending
    })

    // No React act-warning or setState-after-unmount log
    expect(
      errSpy.mock.calls.find((c) =>
        String(c[0] ?? '').includes('unmounted'),
      ),
    ).toBeUndefined()
    errSpy.mockRestore()
  })

  it('picks up latest fetchFn without restarting the interval', async () => {
    const firstFn = vi.fn().mockResolvedValue({ which: 'first' })
    const secondFn = vi.fn().mockResolvedValue({ which: 'second' })

    const { result, rerender } = renderHook(
      ({ fetchFn }) => usePollingQuery({ fetchFn, intervalMs: 1_000 }),
      { initialProps: { fetchFn: firstFn } },
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.data).toEqual({ which: 'first' })

    rerender({ fetchFn: secondFn })
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

    expect(secondFn).toHaveBeenCalled()
    expect(result.current.data).toEqual({ which: 'second' })
    // First fn should not be called again after swap
    expect(firstFn).toHaveBeenCalledTimes(1)
  })
})
