// Shared polling-fetch hook for Issue #420.
// Lifted per RFC §11.2 commitment (commit 849ad17) — two consumers in this PR:
// ManagedEmailFlow's Sending-state /send-progress poll, and LoopMonitor's
// /loop-monitor 60-second auto-refresh.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UsePollingQueryOptions<T> {
  fetchFn: () => Promise<T>
  intervalMs: number
  enabled?: boolean
}

export interface UsePollingQueryResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function usePollingQuery<T>({
  fetchFn,
  intervalMs,
  enabled = true,
}: UsePollingQueryOptions<T>): UsePollingQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<Error | null>(null)

  // Keep latest fetchFn in a ref so the polling effect only re-fires when
  // enabled / intervalMs change, not every render. Callers can pass inline
  // arrow functions without memoization.
  const fetchFnRef = useRef(fetchFn)
  useEffect(() => {
    fetchFnRef.current = fetchFn
  })

  const runFetch = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      const result = await fetchFnRef.current()
      if (signal.cancelled) return
      setData(result)
      setError(null)
    } catch (err) {
      if (signal.cancelled) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!signal.cancelled) setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    const signal = { cancelled: false }
    await runFetch(signal)
  }, [runFetch])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    const signal = { cancelled: false }
    void runFetch(signal)
    const handle = window.setInterval(() => void runFetch(signal), intervalMs)
    return () => {
      signal.cancelled = true
      window.clearInterval(handle)
    }
  }, [enabled, intervalMs, runFetch])

  return { data, loading, error, refetch }
}
