// Issue #420 — MANAGED_EMAIL distribution flow.
// Operator path: configure (audience + composer + survey-batch details) →
// confirm → POST .../distribution-batches with sendMode=MANAGED_EMAIL →
// Sending state polls /send-progress every 2s → Sent state with Retry Failed.
//
// Composer uses TipTap (MustacheEditor) with a Mention palette for the six
// mustache tokens defined in components/managed-email-composer/mustacheTokens.
// Audience reuses #378's /preview endpoint via the same audience spec shape
// (sendMode discriminator only matters at POST).

'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'
import { useModeRouter } from '@/components/mode-router'
import { MustacheEditor } from '@/components/managed-email-composer/MustacheEditor'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'

import type { DistributeMode } from './modes'

type SendingStatus = 'queued' | 'sending' | 'sent' | 'failed'

interface SendProgressRecipient {
  memberId: string
  identifier: string
  firstName: string | null
  lastName: string | null
  status: SendingStatus
  deliveredAt: string | null
  failedAt: string | null
  failureReason: string | null
}

interface SendProgressResponse {
  batchId: string
  recipientCount: number
  queuedCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  isComplete: boolean
  recipients: SendProgressRecipient[]
}

interface PreviewResponse {
  audienceCount: number
  willAutoEnrollCount: number
  unmatchedCount: number
  members: Array<{
    memberId: string | null
    identifier: string
    firstName: string | null
    lastName: string | null
  }>
  unmatched: string[]
}

interface SurveyContext {
  id: string
  title: string | null
  name: string
  status: string
}

type FlowState = 'configure' | 'confirm' | 'sending' | 'sent'

// HTML-form default body — fed into TipTap as the editor's seed content
// (R27). The literal `{{...}}` tokens render in-editor as inline chips via
// the Mention extension and serialize back to plain `{{name}}` strings in
// getHTML() output, which the backend renderTemplate.ts substitutes at
// dispatch.
const DEFAULT_BODY = `<p>Hi {{first_name}},</p><p>We&rsquo;d love your feedback on your recent experience with {{brand_name}}.</p><p>Two minutes. <a href="{{survey_link}}">Take the survey</a>.</p><p>Thanks,<br />{{sender_name}}</p>`

const DEFAULT_SUBJECT_PREFIX = 'A quick survey from'

// Sending-state polling cadence — per RFC §3.4 / §9.1 D3. 2s is the V0 default;
// see D3 pros/cons table for the long-term migration path to SSE.
const SEND_PROGRESS_POLL_MS = 2_000
// Audience-preview debounce — matches the SelfServeFlow's existing cadence so
// the two modes feel consistent.
const PREVIEW_DEBOUNCE_MS = 400

function presetToIsoExpiry(preset: '24h' | '7d' | '30d' | '90d'): string {
  const now = new Date()
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[preset]
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + days)
  target.setUTCHours(23, 59, 59, 999)
  return target.toISOString()
}

export function ManagedEmailFlow({ surveyId }: { surveyId: string }) {
  const { getToken } = useAuth()
  const { switchTo } = useModeRouter<DistributeMode>()

  // Survey context
  const [survey, setSurvey] = useState<SurveyContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Survey Batch details
  const [surveyNameInMail, setSurveyNameInMail] = useState('')
  const [expiryPreset, setExpiryPreset] = useState<'24h' | '7d' | '30d' | '90d'>('7d')

  // Audience — V0 supports two shapes; existing #378 endpoint validates both.
  const [audienceMode, setAudienceMode] = useState<'existing_members' | 'custom_list'>('existing_members')
  const [strategyValue, setStrategyValue] = useState(50)
  const [pasteBody, setPasteBody] = useState('')
  const [autoEnroll, setAutoEnroll] = useState(true)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Composer
  const [senderName, setSenderName] = useState('')
  const [senderAlias, setSenderAlias] = useState('surveys')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(DEFAULT_BODY)
  const [composerError, setComposerError] = useState<string | null>(null)

  // Flow state
  const [flow, setFlow] = useState<FlowState>('configure')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Load survey context
  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await getAuthToken(getToken)
      if (!token) {
        setLoadError('Not authenticated.')
        return
      }
      try {
        const res = await fetch(`${API_URL}/v1/surveys/${surveyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Survey load failed (${res.status})`)
        const data = await res.json()
        if (cancelled) return
        setSurvey({
          id: data.id,
          title: data.title ?? null,
          name: data.name,
          status: data.status,
        })
        const title = data.title ?? data.name
        setSurveyNameInMail(title)
        setSubject(`${DEFAULT_SUBJECT_PREFIX} ${title}`)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [surveyId, getToken])

  // Audience preview (debounced) — reuses #378 /preview endpoint.
  useEffect(() => {
    if (!survey || flow !== 'configure') return
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      const token = await getAuthToken(getToken)
      if (!token) return
      setPreviewing(true)
      try {
        const audience =
          audienceMode === 'existing_members'
            ? { mode: 'existing_members' as const, strategy: 'count' as const, value: strategyValue || 0 }
            : { mode: 'custom_list' as const, identifiers: pasteBody, autoEnroll }
        const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches/preview`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            surveyNameInMail,
            expiresAt: presetToIsoExpiry(expiryPreset),
            audience,
          }),
        })
        if (!res.ok) {
          setPreview(null)
          return
        }
        const data = (await res.json()) as PreviewResponse
        setPreview(data)
      } catch {
        // Preview failures are non-blocking (timeout/AbortError)
      } finally {
        setPreviewing(false)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [surveyId, getToken, survey, flow, audienceMode, strategyValue, pasteBody, autoEnroll, surveyNameInMail, expiryPreset])

  // Polling — Sending state. Shared usePollingQuery handles cancellation +
  // interval lifecycle; we only fetch when the flow is sending and a batchId
  // has been assigned.
  const fetchSendProgress = useCallback(async (): Promise<SendProgressResponse> => {
    const token = await getAuthToken(getToken)
    if (!token) throw new Error('Not authenticated.')
    const res = await fetch(
      `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/send-progress`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`send-progress ${res.status}`)
    return (await res.json()) as SendProgressResponse
  }, [surveyId, batchId, getToken])

  const { data: progress } = usePollingQuery<SendProgressResponse>({
    fetchFn: fetchSendProgress,
    intervalMs: SEND_PROGRESS_POLL_MS,
    enabled: flow === 'sending' && !!batchId,
  })

  useEffect(() => {
    if (progress?.isComplete) setFlow('sent')
  }, [progress?.isComplete])

  const validateComposer = useCallback((): string | null => {
    if (!senderName.trim()) return 'Sender name is required.'
    if (!/^[a-z0-9._-]+$/.test(senderAlias.trim())) {
      return 'Sender alias must be lowercase letters, numbers, dots, underscores, or dashes.'
    }
    if (!subject.trim()) return 'Subject is required.'
    if (!body.trim()) return 'Email body is required.'
    if (!/\{\{\s*survey_link\s*\}\}/.test(body)) {
      return 'Body must contain {{survey_link}} so each recipient gets their own link.'
    }
    return null
  }, [senderName, senderAlias, subject, body])

  const handleContinueToConfirm = useCallback(() => {
    const err = validateComposer()
    setComposerError(err)
    if (err) return
    setFlow('confirm')
  }, [validateComposer])

  const handleConfirmSend = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const token = await getAuthToken(getToken)
      if (!token) throw new Error('Not authenticated.')
      const audience =
        audienceMode === 'existing_members'
          ? { mode: 'existing_members' as const, strategy: 'count' as const, value: strategyValue || 0 }
          : { mode: 'custom_list' as const, identifiers: pasteBody, autoEnroll }
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sendMode: 'MANAGED_EMAIL',
          surveyNameInMail,
          expiresAt: presetToIsoExpiry(expiryPreset),
          audience,
          composer: { senderName, senderAlias, subject, body },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Send failed (${res.status})`)
      }
      const data = await res.json()
      setBatchId(data.batchId)
      setFlow('sending')
    } catch (err) {
      setSubmitError((err as Error).message)
      setFlow('configure')
    } finally {
      setSubmitting(false)
    }
  }, [getToken, surveyId, audienceMode, strategyValue, pasteBody, autoEnroll, surveyNameInMail, expiryPreset, senderName, senderAlias, subject, body])

  const handleRetryFailed = useCallback(async () => {
    if (!batchId) return
    setRetrying(true)
    try {
      const token = await getAuthToken(getToken)
      if (!token) return
      const res = await fetch(
        `${API_URL}/v1/surveys/${surveyId}/distribution-batches/${batchId}/retry-failed`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (res.ok) {
        setFlow('sending')
      }
    } finally {
      setRetrying(false)
    }
  }, [batchId, getToken, surveyId])

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">Loading…</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-600">Send via CustomerEQ</p>
          <h1 className="text-2xl font-semibold text-gray-900">{survey.title ?? survey.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => switchTo('self-serve')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Switch to my email tool →
        </button>
      </header>

      {flow === 'configure' && (
        <>
          {/* Survey Batch details */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Survey Batch details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Survey name in mail</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={surveyNameInMail}
                  onChange={(e) => setSurveyNameInMail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Links expire on</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={expiryPreset}
                  onChange={(e) => setExpiryPreset(e.target.value as typeof expiryPreset)}
                >
                  <option value="24h">In 24 hours</option>
                  <option value="7d">In 7 days</option>
                  <option value="30d">In 30 days</option>
                  <option value="90d">In 90 days</option>
                </select>
              </label>
            </div>
          </section>

          {/* Audience */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Audience</h2>
            <div className="mb-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={audienceMode === 'existing_members'}
                  onChange={() => setAudienceMode('existing_members')}
                />
                Existing members
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={audienceMode === 'custom_list'}
                  onChange={() => setAudienceMode('custom_list')}
                />
                Custom list
              </label>
            </div>
            {audienceMode === 'existing_members' ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Count</span>
                <input
                  type="number"
                  min={0}
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={strategyValue}
                  onChange={(e) => setStrategyValue(Number(e.target.value))}
                />
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">
                    Paste emails or member IDs (one per line)
                  </span>
                  <textarea
                    className="h-32 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
                    value={pasteBody}
                    onChange={(e) => setPasteBody(e.target.value)}
                  />
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoEnroll}
                    onChange={(e) => setAutoEnroll(e.target.checked)}
                  />
                  Auto-enroll unknown identifiers as new members
                </label>
              </>
            )}
            {previewing && <p className="mt-2 text-xs text-gray-500">Previewing…</p>}
            {preview && (
              <p className="mt-2 text-sm text-gray-700">
                {preview.audienceCount} {preview.audienceCount === 1 ? 'recipient' : 'recipients'}
                {preview.willAutoEnrollCount > 0 && (
                  <span className="ml-2 text-gray-500">
                    ({preview.willAutoEnrollCount} will auto-enroll)
                  </span>
                )}
                {preview.unmatchedCount > 0 && (
                  <span className="ml-2 text-amber-700">
                    ({preview.unmatchedCount} unmatched)
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Composer */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Compose email</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Sender name</span>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Maya at Acme"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Sender alias</span>
                  <div className="flex items-center rounded-md border border-gray-300">
                    <input
                      type="text"
                      className="flex-1 rounded-l-md border-0 px-3 py-2 text-sm focus:outline-none"
                      value={senderAlias}
                      onChange={(e) => setSenderAlias(e.target.value.toLowerCase())}
                    />
                    <span className="rounded-r-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      @customereq.wellnessatwork.me
                    </span>
                  </div>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Subject</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <div className="block text-sm">
                <label
                  htmlFor="managed-email-body"
                  className="mb-1 block font-medium text-gray-700"
                >
                  Body — must contain {'{{survey_link}}'}
                </label>
                <MustacheEditor
                  id="managed-email-body"
                  ariaLabel="Email body"
                  value={body}
                  onChange={setBody}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Type <code className="rounded bg-gray-100 px-1">{`{{`}</code> to insert a token,
                  or pick one from the toolbar.
                </p>
              </div>
              {composerError && (
                <p className="text-sm text-red-700" role="alert">
                  {composerError}
                </p>
              )}
            </div>
          </section>

          {submitError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleContinueToConfirm}
              disabled={!preview || preview.audienceCount === 0}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send via CustomerEQ →
            </button>
          </div>
        </>
      )}

      {flow === 'confirm' && (
        <div role="dialog" className="rounded-lg border border-indigo-200 bg-white p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">Confirm send</h2>
          <p className="text-sm text-gray-700">
            CustomerEQ will dispatch <strong>{preview?.audienceCount}</strong> emails right now from{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              {senderAlias}@customereq.wellnessatwork.me
            </code>
            . Recipients can&apos;t be recalled after dispatch begins.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFlow('configure')}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Dispatching…' : 'Send now'}
            </button>
          </div>
        </div>
      )}

      {(flow === 'sending' || flow === 'sent') && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            {flow === 'sending' ? 'Sending…' : 'Sent'}
          </h2>
          {progress ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Stat label="Queued" value={progress.queuedCount} />
                <Stat label="Sent" value={progress.sentCount} tone="success" />
                <Stat label="Failed" value={progress.failedCount} tone="error" />
                <Stat label="Skipped" value={progress.skippedCount} tone="muted" />
              </div>
              <div className="max-h-96 overflow-y-auto rounded border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-700">Recipient</th>
                      <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                      <th className="px-3 py-2 font-medium text-gray-700">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.recipients.map((r) => (
                      <tr key={r.memberId} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {r.firstName ?? ''} {r.lastName ?? ''}{' '}
                          <span className="text-gray-500">{r.identifier}</span>
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.failureReason ?? (r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {flow === 'sent' && progress.failedCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    disabled={retrying}
                    className="rounded-md border border-indigo-600 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    {retrying ? 'Retrying…' : `Retry ${progress.failedCount} failed`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">Polling…</p>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'success' | 'error' | 'muted' | 'neutral' }) {
  const colors = {
    success: 'text-green-700',
    error: 'text-red-700',
    muted: 'text-gray-500',
    neutral: 'text-gray-900',
  }
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${colors[tone]}`}>{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: SendingStatus }) {
  const map = {
    queued: { label: 'Queued', cls: 'bg-gray-100 text-gray-700' },
    sending: { label: 'Sending', cls: 'bg-blue-100 text-blue-700' },
    sent: { label: 'Sent', cls: 'bg-green-100 text-green-700' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = map[status]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}
