// Spec §3.2 — historical per-recipient send log on the Wave Detail page for
// MANAGED_EMAIL batches. Driven by the existing 2s-polled /send-progress
// endpoint (no SSE — plain GET). Polling auto-stops once isComplete=true so
// an operator landing on a finished batch only does one round-trip.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'
import { SendProgressTable } from '@/components/surveys/SendProgressTable'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'
import type { SendProgressResponse } from '@customerEQ/shared'

const POLL_MS = 2_000

export function RecipientSendLogBlock({
  surveyId,
  batchId,
  brandTimezone,
  brandLocale,
}: {
  surveyId: string
  batchId: string
  brandTimezone: string
  brandLocale: string
}) {
  const { getToken } = useAuth()
  const [pollEnabled, setPollEnabled] = useState(true)

  const fetchProgress = useCallback(async (): Promise<SendProgressResponse> => {
    const token = await getAuthToken(getToken)
    if (!token) throw new Error('Sign in to load send log.')
    const res = await fetch(
      `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/send-progress`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`send-progress ${res.status}`)
    return (await res.json()) as SendProgressResponse
  }, [surveyId, batchId, getToken])

  const { data: progress, loading, error } = usePollingQuery<SendProgressResponse>({
    fetchFn: fetchProgress,
    intervalMs: POLL_MS,
    enabled: pollEnabled,
  })

  useEffect(() => {
    if (progress?.isComplete) setPollEnabled(false)
  }, [progress?.isComplete])

  if (loading && !progress) {
    return (
      <section
        className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
        data-testid="recipient-send-log-loading"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Send log</h2>
        <p className="text-xs text-gray-500">Loading…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
        data-testid="recipient-send-log-error"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Send log</h2>
        <p className="text-xs text-red-700">Failed to load send log: {error.message}</p>
      </section>
    )
  }

  if (!progress) return null

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
      data-testid="recipient-send-log-block"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Send log</h2>
        <p className="text-[11px] text-gray-500">
          {progress.sentCount} sent · {progress.failedCount} failed · {progress.skippedCount} skipped
          {progress.isComplete ? '' : ` · ${progress.queuedCount} queued (in flight)`}
        </p>
      </div>
      <SendProgressTable
        recipients={progress.recipients}
        brandTimezone={brandTimezone}
        brandLocale={brandLocale}
      />
      {progress.recipients.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">No recipients in this batch.</p>
      ) : null}
    </section>
  )
}
