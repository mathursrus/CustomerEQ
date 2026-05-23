// Issue #420 — MANAGED_EMAIL distribution flow.
// Operator path: configure (Survey Batch details + shared audience builder +
// composer) → confirm → POST .../distribution-batches with
// sendMode=MANAGED_EMAIL → Sending state polls /send-progress every 2s →
// Sent state with Retry Failed.
//
// Composer uses TipTap (MustacheEditor) with a Mention palette for the six
// mustache tokens defined in components/managed-email-composer/mustacheTokens.
//
// Round 1 review feedback (lifted into this PR): the audience UI now uses the
// shared <AudienceBuilder> (spec §2.2 R16/R18/R20/R22/R23/R43) — identical
// shape across both modes, so the audience picks survive a mode switch and
// every requirement the spec lists is met on this surface.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { API_URL, getAuthToken } from '@/lib/config'
import { useModeRouter } from '@/components/mode-router'
import { MustacheEditor } from '@/components/managed-email-composer/MustacheEditor'
import { SendProgressTable } from '@/components/surveys/SendProgressTable'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'

import type { DistributeMode } from './modes'
import {
  SurveyBatchDetailsCard,
  type ExpiryPreset,
} from './SurveyBatchDetailsCard'
import {
  AudienceBuilder,
  type AudienceBuilderState,
} from './audience-builder'

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

interface SurveyContext {
  id: string
  title: string | null
  name: string
  status: string
}

interface BrandContext {
  timezone: string
  memberCount: number
}

type FlowState = 'configure' | 'confirm' | 'sending' | 'sent'

// Mock #scene-3 lines 726–736 — default body opens with the {{brand_logo}}
// + {{brand_name}} header block (renders as logo + brand name in the
// recipient's email; operator may delete to suppress the header), then
// asks for feedback on {{survey_title}} with the bare {{survey_link}} line
// recipients click. The mustache tokens are non-editable atoms in the
// editor — see MustacheEditor.tsx — and serialize back to the literal
// {{token}} strings the worker renders.
const DEFAULT_BODY = `<p>{{brand_logo}}</p><p>{{brand_name}}</p><p>Hi {{first_name}},</p><p>We&rsquo;d love your feedback on {{survey_title}}. It takes about 2 minutes.</p><p>{{survey_link}}</p><p>Thanks,<br />{{sender_name}}</p>`

// Mock #scene-3 line 708 default subject is "Quick question: <survey title>".
const DEFAULT_SUBJECT_PREFIX = 'Quick question:'

// Sending-state polling cadence — per RFC §3.4 / §9.1 D3. 2s is the V0 default.
const SEND_PROGRESS_POLL_MS = 2_000

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

  // Survey + brand context
  const [survey, setSurvey] = useState<SurveyContext | null>(null)
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Survey Batch details
  const [surveyNameInMail, setSurveyNameInMail] = useState('')
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('7d')
  const [customExpiry, setCustomExpiry] = useState('')

  // Audience — shared builder owns its own state and emits upward.
  const [audience, setAudience] = useState<AudienceBuilderState | null>(null)

  // Composer
  const [senderName, setSenderName] = useState('')
  const [senderAlias, setSenderAlias] = useState('feedback')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(DEFAULT_BODY)
  const [composerError, setComposerError] = useState<string | null>(null)

  // Flow state
  const [flow, setFlow] = useState<FlowState>('configure')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Load survey + brand context
  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await getAuthToken(getToken)
      if (!token) {
        setLoadError('Not authenticated.')
        return
      }
      try {
        const [surveyRes, brandRes, memberCountRes] = await Promise.all([
          fetch(`${API_URL}/v1/surveys/${surveyId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/v1/admin/brand/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/v1/members?pageSize=1`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])
        if (!surveyRes.ok) throw new Error(`Survey load failed (${surveyRes.status})`)
        if (!brandRes.ok) throw new Error(`Brand load failed (${brandRes.status})`)
        const surveyData = await surveyRes.json()
        const brandData = await brandRes.json()
        let memberCount = 0
        if (memberCountRes.ok) {
          const mb = await memberCountRes.json()
          memberCount = mb.total ?? 0
        }
        if (cancelled) return
        setSurvey({
          id: surveyData.id,
          title: surveyData.title ?? null,
          name: surveyData.name,
          status: surveyData.status,
        })
        setBrand({
          timezone: brandData.timezone ?? 'UTC',
          memberCount,
        })
        const title = surveyData.title ?? surveyData.name
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

  const expiresAtIso =
    expiryPreset === 'custom'
      ? customExpiry || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      : presetToIsoExpiry(expiryPreset)

  // Polling — Sending state.
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
    if (!audience) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const token = await getAuthToken(getToken)
      if (!token) throw new Error('Not authenticated.')
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sendMode: 'MANAGED_EMAIL',
          surveyNameInMail,
          expiresAt: expiresAtIso,
          audience: audience.submitAudience,
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
  }, [getToken, surveyId, audience, surveyNameInMail, expiresAtIso, senderName, senderAlias, subject, body])

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
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    )
  }

  if (!survey || !brand) {
    return <div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-600">Send via CustomerEQ</p>
          <h1 className="text-2xl font-semibold text-gray-900">{survey.title ?? survey.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => switchTo('self-serve')}
          className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Switch to my email tool →
        </button>
      </header>

      {flow === 'configure' && (
        <>
          <SurveyBatchDetailsCard
            surveyNameInMail={surveyNameInMail}
            setSurveyNameInMail={setSurveyNameInMail}
            expiryPreset={expiryPreset}
            setExpiryPreset={setExpiryPreset}
            customExpiry={customExpiry}
            setCustomExpiry={setCustomExpiry}
            brandTimezone={brand.timezone}
          />

          <div>
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                Step 2 · Shared · Both modes
              </span>
              <h2 className="text-sm font-semibold text-gray-900">Select members</h2>
            </div>
            <AudienceBuilder
              surveyId={surveyId}
              surveyNameInMail={surveyNameInMail}
              expiresAtIso={expiresAtIso}
              totalMemberCount={brand.memberCount}
              onChange={setAudience}
            />
          </div>

          {/* Composer */}
          <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-800">
                Step 3 · Mode-specific · CustomerEQ Email
              </span>
              <h2 className="text-sm font-semibold text-gray-900">Compose email</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Sender name</span>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Acme CX Team"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">
                    Sender alias (local-part)
                  </span>
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

          {/* Mock #scene-3 line 803 — pre-submit recap; sender + survey name +
              expiry surfaced one last time before the confirm dialog. Mirror
              of the SELF_SERVE recap (mock #scene-2 line 530). */}
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            data-testid="managed-email-pre-submit-recap"
          >
            <p className="text-sm text-gray-700">
              Ready to send{' '}
              <strong className="text-gray-900">
                {audience?.selectedCount ?? 0} email{audience?.selectedCount === 1 ? '' : 's'}
              </strong>{' '}
              from{' '}
              <strong className="text-gray-900">
                {senderName || '—'} &lt;{senderAlias}@customereq.wellnessatwork.me&gt;
              </strong>
              . Survey name: <strong className="text-gray-900">{surveyNameInMail || '—'}</strong>.
              Links expire{' '}
              <strong className="text-gray-900">
                {new Date(expiresAtIso).toLocaleString(undefined, {
                  timeZone: brand.timezone,
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={handleContinueToConfirm}
              disabled={!audience || audience.selectedCount === 0}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send {audience?.selectedCount ?? 0} emails →
            </button>
          </div>
        </>
      )}

      {flow === 'confirm' && (
        <div role="dialog" className="rounded-lg border border-indigo-200 bg-white p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">Confirm send</h2>
          <p className="text-sm text-gray-700">
            CustomerEQ will dispatch <strong>{audience?.selectedCount ?? 0}</strong> emails right
            now from{' '}
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
              <SendProgressTable recipients={progress.recipients} />
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

