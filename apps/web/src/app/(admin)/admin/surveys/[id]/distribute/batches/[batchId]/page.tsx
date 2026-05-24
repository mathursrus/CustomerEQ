// Issue #378 — Batch detail page (spec §3.1).
//
// Header (label + status + counters) + Audience Spec block + Expiry control
// (editable both directions) + Tokens table (paginated) + Regenerate
// confirmation modal.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'
import { SendModePill } from '@/components/surveys/SendModePill'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'
import type { SendProgressResponse } from '@customerEQ/shared'

import { ComposerSnapshotBlock, type ComposerSnapshot } from './ComposerSnapshotBlock'

interface BatchDetail {
  id: string
  surveyId: string
  label: string
  surveyNameInMail: string
  expiresAt: string
  createdAt: string
  createdBy: string
  /** Issue #420 §3.2 — drives the mode pill and gates the Composer block. */
  sendMode: 'SELF_SERVE' | 'MANAGED_EMAIL'
  /** Populated only when sendMode='MANAGED_EMAIL' (spec §3.2). */
  composerSnapshot: ComposerSnapshot | null
  audienceSpec: {
    mode: 'existing_members' | 'custom_list'
    description: string
    memberCountAtSendTime: number
    memberCountNow: number
  }
  counters: {
    sentCount: number
    respondedCount: number
    awaitingCount: number
    expiredCount: number
    // G13 — MANAGED_EMAIL surfaces Failed + Skipped via /send-progress; these
    // come from the polling source below, not the batch-detail counters.
  }
  tokens: {
    data: {
      memberId: string
      firstName: string | null
      lastName: string | null
      identifier: string
      tokenPrefix: string
      status: 'awaiting_response' | 'responded' | 'expired'
      respondedAt: string | null
    }[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

interface BrandContext {
  timezone: string
  locale: string
  memberIdentifierKind: 'email' | 'phone' | 'external_id'
}

function identifierHeaderLabel(kind: 'email' | 'phone' | 'external_id'): string {
  // Matches the per-brand customer-facing column header used by the Generate
  // CSV download (apps/web/.../distribute/page.tsx). Keeps the regenerated
  // CSV consistent with the original (#378 walk-through #10).
  return { email: 'Email', phone: 'Phone Number', external_id: 'Customer ID' }[kind]
}

function brandKindToClient(raw: string | undefined): 'email' | 'phone' | 'external_id' {
  switch ((raw ?? 'EMAIL').toUpperCase()) {
    case 'PHONE':
      return 'phone'
    case 'CUSTOMER_ID':
      return 'external_id'
    case 'EMAIL':
    default:
      return 'email'
  }
}

function fmt(iso: string, tz: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

export default function BatchDetailPage() {
  const params = useParams<{ id: string; batchId: string }>()
  const { id: surveyId, batchId } = params
  const { getToken } = useAuth()

  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingExpiry, setEditingExpiry] = useState<boolean>(false)
  const [newExpiry, setNewExpiry] = useState<string>('')

  const [showRegenerateModal, setShowRegenerateModal] = useState<boolean>(false)
  const [regenerating, setRegenerating] = useState<boolean>(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const token = await getAuthToken(getToken)
    if (!token) {
      setError('Not authenticated.')
      return
    }
    try {
      const [batchRes, brandRes] = await Promise.all([
        fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/v1/admin/brand/profile`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (!batchRes.ok) {
        setError(`Failed to load batch: ${batchRes.status}`)
        return
      }
      const batchBody = (await batchRes.json()) as BatchDetail
      setBatch(batchBody)
      if (brandRes.ok) {
        const bb = await brandRes.json()
        setBrand({
          timezone: bb.timezone ?? 'UTC',
          locale: bb.locale ?? 'en-US',
          memberIdentifierKind: brandKindToClient(bb.memberIdentifierKind),
        })
      } else {
        setBrand({ timezone: 'UTC', locale: 'en-US', memberIdentifierKind: 'email' })
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [surveyId, batchId, getToken])

  useEffect(() => {
    void reload()
  }, [reload])

  // G13 — drive Failed + Skipped counters (and per-recipient send-state) from
  // the /send-progress endpoint when this batch is MANAGED_EMAIL. Polling
  // stops once isComplete = true so a fully-sent batch only does one round
  // trip. SELF_SERVE batches have no platform send log; this stays disabled.
  const fetchSendProgress = useCallback(async (): Promise<SendProgressResponse> => {
    const token = await getAuthToken(getToken)
    if (!token) throw new Error('Sign in to load send log.')
    const res = await fetch(
      `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/send-progress`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`send-progress ${res.status}`)
    return (await res.json()) as SendProgressResponse
  }, [surveyId, batchId, getToken])

  const isManaged = batch?.sendMode === 'MANAGED_EMAIL'
  const [progressPollEnabled, setProgressPollEnabled] = useState(true)
  const { data: progress } = usePollingQuery<SendProgressResponse>({
    fetchFn: fetchSendProgress,
    intervalMs: 2_000,
    enabled: Boolean(isManaged) && progressPollEnabled,
  })
  useEffect(() => {
    if (progress?.isComplete) setProgressPollEnabled(false)
  }, [progress?.isComplete])

  // Per-recipient send-state lookup keyed by memberId. Empty map for
  // SELF_SERVE (no platform-side per-recipient state) — table rows just
  // surface response status.
  const sendStateByMemberId = new Map(
    (progress?.recipients ?? []).map((r) => [r.memberId, r] as const),
  )

  const submitEditExpiry = useCallback(async () => {
    if (!newExpiry) return
    const token = await getAuthToken(getToken)
    if (!token) return
    const isoNew = new Date(newExpiry).toISOString()
    const res = await fetch(
      `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/expiry`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expiresAt: isoNew }),
      },
    )
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      setError(errBody.error ?? `Failed to update expiry (${res.status})`)
      return
    }
    setEditingExpiry(false)
    setNewExpiry('')
    await reload()
  }, [newExpiry, getToken, surveyId, batchId, reload])

  const confirmRegenerate = useCallback(
    async (format: 'generic' | 'mailchimp' | 'hubspot' | 'klaviyo') => {
      setRegenerating(true)
      setRegenerateError(null)
      try {
        const token = await getAuthToken(getToken)
        if (!token) return
        const res = await fetch(
          `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/regenerate-tokens`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ format, confirmAcknowledge: true }),
          },
        )
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          setRegenerateError(errBody.error ?? `Failed (${res.status})`)
          return
        }
        // Download CSV from response.
        const body = (await res.json()) as {
          batchId: string
          tokens: { plaintext: string; identifier: string; firstName: string | null; lastName: string | null; memberId: string }[]
        }
        const baseUrl =
          typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''
        // Drop internal `memberId` from the customer-facing CSV; rename the
        // identifier column to the brand's term (#378 walk-through #10).
        const idHeader = identifierHeaderLabel(brand?.memberIdentifierKind ?? 'email')
        const csv = [
          `${idHeader},firstName,lastName,surveyName,mergeTagUrl`,
          ...body.tokens.map((t) =>
            [
              t.identifier,
              t.firstName ?? '',
              t.lastName ?? '',
              batch?.surveyNameInMail ?? '',
              `${baseUrl}/survey/${surveyId}/r/${t.plaintext}`,
            ]
              .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
              .join(','),
          ),
        ].join('\n')
        // Filename matches the original distribute-page download convention
        // (`${safeName}-${yyyymmdd}-links.csv`) with a `regenerated-` prefix so
        // operators can pair the regenerated CSV with the one they downloaded
        // at batch creation (issue #378 walk-through feedback #13).
        const safeName = (batch?.surveyNameInMail || 'survey').replace(/[^A-Za-z0-9-]/g, '-')
        const yyyymmdd = new Date().toISOString().slice(0, 10)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `regenerated-${safeName}-${yyyymmdd}-links.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        setShowRegenerateModal(false)
        await reload()
      } catch (err) {
        setRegenerateError((err as Error).message)
      } finally {
        setRegenerating(false)
      }
    },
    [surveyId, batchId, getToken, reload, batch],
  )

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-red-600">{error}</p>
        <a href={`/admin/surveys/${surveyId}`} className="text-indigo-600 hover:underline">
          ← Back to survey
        </a>
      </main>
    )
  }
  if (!batch || !brand) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-gray-500">Loading…</p>
      </main>
    )
  }

  const now = new Date()
  const isExpired = new Date(batch.expiresAt) < now

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <a href={`/admin/surveys/${surveyId}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to survey
      </a>
      <header className="mt-2 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{batch.label}</h1>
          {/* Issue #420 §3.2 — mode pill at the top of the page (md sized for the header). */}
          <SendModePill mode={batch.sendMode} size="md" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span
            className={`rounded-full px-2 py-1 ${
              isExpired ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
            }`}
          >
            {isExpired ? 'Expired' : 'Active'}
          </span>
          <span>Sent: {batch.counters.sentCount}</span>
          <span>Responded: {batch.counters.respondedCount}</span>
          <span>Awaiting: {batch.counters.awaitingCount}</span>
          <span>Expired: {batch.counters.expiredCount}</span>
          {/* G13 — Failed + Skipped only show for MANAGED_EMAIL (platform
              dispatch path). SELF_SERVE has no platform-side delivery state. */}
          {isManaged && progress ? (
            <>
              <span>Failed: {progress.failedCount}</span>
              <span>Skipped: {progress.skippedCount}</span>
            </>
          ) : null}
        </div>
      </header>

      {/* Mock #scene-7a lines 1200–1202 + #scene-7b lines 1318–1320 — Sent
          semantics differ by send mode; surface the explainer prominently
          near the counters so operators understand what the Sent number
          counts (CSV-download events vs platform-confirmed delivery). */}
      {batch.sendMode === 'SELF_SERVE' ? (
        <div
          className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-gray-700"
          data-testid="sent-semantics-self-serve"
        >
          <strong className="text-gray-900">Sent semantics on this batch (Self-serve):</strong>{' '}
          incremented when the operator downloaded the CSV (the dispatch-handoff moment).
          Re-incremented on Regenerate Links. Failed is n/a because the platform did not dispatch
          the email — the operator&apos;s own email tool did.
        </div>
      ) : (
        <div
          className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-gray-700"
          data-testid="sent-semantics-managed"
        >
          <strong className="text-gray-900">Sent semantics on this batch (CustomerEQ Email):</strong>{' '}
          incremented per-recipient as the platform confirms email delivery. For Self-serve
          batches, Sent increments at CSV download time and re-increments if Regenerate Links is
          used.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Audience</h2>
        <p className="text-xs text-gray-600">{batch.audienceSpec.description}</p>
        <p className="mt-2 text-xs text-gray-600">
          Members in audience at send time: {batch.audienceSpec.memberCountAtSendTime} · Members in
          audience now: {batch.audienceSpec.memberCountNow}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Created at {fmt(batch.createdAt, brand.timezone, brand.locale)} by {batch.createdBy}
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Expiry</h2>
        {editingExpiry ? (
          <div className="space-y-2">
            <input
              type="datetime-local"
              value={newExpiry.replace('Z', '').slice(0, 16)}
              onChange={(e) => setNewExpiry(new Date(e.target.value).toISOString())}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <p className="text-xs text-gray-500">All times in {brand.timezone}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitEditExpiry}
                className="rounded bg-indigo-600 px-3 py-1 text-xs text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingExpiry(false)}
                className="rounded border border-gray-300 px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-700">
              Links expire on: {fmt(batch.expiresAt, brand.timezone, brand.locale)}
            </p>
            <button
              type="button"
              onClick={() => setEditingExpiry(true)}
              disabled={isExpired}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              [Edit]
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Tokens</h2>
          {/* Issue #420 §3.2 — Regenerate-Links is hidden for MANAGED_EMAIL
              batches: there's no CSV to re-download (the platform owns dispatch),
              and re-send semantics intersect with Member.unsubscribedSurveysAt
              in ways deliberately outside V0 scope. */}
          {batch.sendMode !== 'MANAGED_EMAIL' ? (
            <button
              type="button"
              onClick={() => setShowRegenerateModal(true)}
              className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              ⬇ Regenerate links + download CSV
            </button>
          ) : null}
        </div>
        {/* G13 — Tokens + Send Log merged into one table. Status column
            collapses both signals: respond-status wins ("Responded"),
            otherwise per-recipient platform send-state for MANAGED_EMAIL
            (Failed / Skipped / Sent — awaiting response), otherwise the
            token's response status ("Awaiting response" / "Expired"). The
            page-level summary at the top is the single counts surface;
            we do NOT repeat counts inside the section header per the user's
            sharpened rule. */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-gray-600 border-b border-gray-200">
              <tr>
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Identifier</th>
                <th className="py-2 pr-3">Token prefix</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Detail</th>
                <th className="py-2 pr-3">Responded at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batch.tokens.data.map((t) => {
                const sendState = sendStateByMemberId.get(t.memberId)
                let statusText: string
                let detailText = '—'
                let statusClass: string
                if (t.status === 'responded') {
                  statusText = 'Responded'
                  statusClass = 'text-green-700'
                } else if (t.status === 'expired') {
                  statusText = 'Expired'
                  statusClass = 'text-gray-500'
                } else if (sendState?.status === 'failed') {
                  statusText = 'Failed'
                  detailText = sendState.failureReason ?? '—'
                  statusClass = 'text-red-700'
                } else if (sendState?.status === 'sent') {
                  statusText = 'Sent — awaiting response'
                  statusClass = 'text-indigo-700'
                } else if (sendState?.status === 'queued' || sendState?.status === 'sending') {
                  statusText = sendState.status === 'sending' ? 'Sending…' : 'Queued'
                  statusClass = 'text-amber-700'
                } else if (sendState?.failureReason && sendState.failureReason.startsWith('skipped_')) {
                  statusText = 'Skipped'
                  detailText = sendState.failureReason.replace(/^skipped_/, '').replace(/_/g, ' ')
                  statusClass = 'text-amber-700'
                } else {
                  statusText = 'Awaiting response'
                  statusClass = 'text-gray-600'
                }
                return (
                  <tr key={t.memberId}>
                    <td className="py-2 pr-3">
                      {[t.firstName, t.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-2 pr-3 font-mono">{t.identifier}</td>
                    <td className="py-2 pr-3 font-mono">{t.tokenPrefix}</td>
                    <td className={`py-2 pr-3 font-medium ${statusClass}`}>{statusText}</td>
                    <td className="py-2 pr-3 text-gray-600">{detailText}</td>
                    <td className="py-2 pr-3">
                      {t.respondedAt ? fmt(t.respondedAt, brand.timezone, brand.locale) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Showing {batch.tokens.data.length} of {batch.tokens.total} recipients
        </p>
      </section>

      {/* G11 — Composer Snapshot moved BELOW the Tokens table so operators
          land first on the per-recipient state and audit the rendered
          composer separately. G12 — the snapshot block now reuses
          EmailPreviewCard so the WYSIWYG view matches compose-time exactly
          (mustache substitutions, theme colors, brand identity placement). */}
      {batch.sendMode === 'MANAGED_EMAIL' && batch.composerSnapshot ? (
        <ComposerSnapshotBlock snapshot={batch.composerSnapshot} surveyId={surveyId} />
      ) : null}

      {/* Mock #scene-7a lines 1255–1257 — Self-serve has no platform-side
          per-recipient delivery log. Surface this explicitly so operators
          looking for failure detail understand why it is absent. */}
      {batch.sendMode === 'SELF_SERVE' ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
          data-testid="no-platform-send-log-warning"
        >
          <strong>⚠ No platform-side send log for Self-serve batches.</strong> The operator&apos;s
          own email tool dispatched these — CustomerEQ does not have per-recipient delivery
          confirmations for Self-serve. The Sent counter reflects CSV-download events; Responded
          reflects actual respondent submissions; Failed is not applicable.
        </div>
      ) : null}

      {showRegenerateModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
            <p className="font-semibold text-gray-900">⚠ Regenerating links will invalidate the previous URLs.</p>
            <p className="mt-3 text-sm text-gray-700">
              Use this only if the previous emails have NOT been sent yet. If recipients have already
              received emails with the previous URLs, they will see &quot;This link is not valid&quot;
              and won&apos;t be able to respond.
            </p>
            <p className="mt-3 text-sm text-gray-700">
              This action exists for operator-error recovery (e.g., you lost the CSV before pasting
              it into your email tool). It is <strong>not</strong> a way to get a second copy of
              links you already distributed.
            </p>
            {regenerateError ? (
              <p className="mt-3 text-sm text-red-700">{regenerateError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRegenerateModal(false)}
                disabled={regenerating}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmRegenerate('generic')}
                disabled={regenerating}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : `Yes, regenerate ${batch.counters.sentCount} links`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
