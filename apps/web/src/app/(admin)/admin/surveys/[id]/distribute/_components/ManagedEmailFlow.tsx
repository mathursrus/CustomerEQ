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
import { EmailPreviewCard } from '@/components/managed-email-composer/EmailPreviewCard'
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
  /** R30c — surfaced in the live email preview pane (mock #scene-3 lines
   *  747–800) for {{brand_name}} + {{brand_logo}} substitution. */
  name: string
  logoUrl: string | null
  /** F14 — default theme colors so the preview matches what the worker
   *  renders via packages/shared/src/email/renderTemplate.ts. */
  theme: {
    primaryColor: string
    backgroundColor: string
    textColor: string
    accentColor: string
    buttonColor: string
    buttonTextColor: string
    fontFamily: string
  } | null
}

// MANAGED_EMAIL sender-domain fallback chain — mirrors R25. Surfaced in the
// preview pane's From line + the recap row above the CTA. Until V1 lifts
// Brand.managedEmailSenderDomain into the brand profile, the V0 default is
// the hard-coded customereq.wellnessatwork.me. The literal lives here so the
// composer + preview show the same value the worker will dispatch from.
const SENDER_DOMAIN = 'customereq.wellnessatwork.me'

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

  // F6 — beforeunload guard while the configure step has unsaved work. Catches
  // refresh / close-tab / typing a new URL / external-site navigation. Does NOT
  // catch in-app Next router navigation (sidebar links); persisting state across
  // in-app nav would require lifting the configure form into a context or
  // serializing into sessionStorage on every keystroke — left as a follow-up.
  const audienceSelectedCount = audience?.selectedCount ?? 0
  const isDirty =
    flow === 'configure' &&
    (audienceSelectedCount > 0 ||
      surveyNameInMail.trim() !== '' ||
      senderName.trim() !== '' ||
      body !== DEFAULT_BODY)
  useEffect(() => {
    if (!isDirty) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Most browsers ignore the custom string and show their generic prompt,
      // but setting returnValue is still required for the prompt to fire.
      e.returnValue = ''
    }
    // F6 — in-app navigation guard. beforeunload doesn't fire for Next.js
    // soft-nav (sidebar `Link` → router.push), which was the user's actual
    // reported case. We capture the click at the document level BEFORE React's
    // delegated handlers run so we can preventDefault on the native event
    // (which prevents both browser nav and Next's router.push) when the
    // operator cancels the confirm. Capture-phase + stopImmediatePropagation
    // is required to beat React's synthetic-event dispatch.
    const clickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      if (e.button !== 0) return // left-click only
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return // open-in-new-tab etc.
      const anchor = (e.target as Element | null)?.closest('a')
      if (!anchor) return
      if (anchor.hasAttribute('download')) return
      if (anchor.getAttribute('target') === '_blank') return
      const href = anchor.getAttribute('href')
      if (!href) return
      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return // external — beforeunload handles
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      const ok = window.confirm('You have unsaved changes in this send. Leave anyway?')
      if (!ok) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', clickCapture, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', clickCapture, true)
    }
  }, [isDirty])

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
        // /v1/admin/brand/profile wraps the brand under `brand` and exposes
        // themes alongside it (see apps/api/src/routes/admin-brand-profile.ts
        // — `{ brand, themes, memberCount, supportEmail }`). The previous
        // unwrap (brandData.timezone / .name / .logoUrl) read the wrong
        // nesting level and silently fell through to defaults (F5 + F15).
        const b = brandData.brand ?? brandData
        const themes = Array.isArray(brandData.themes) ? brandData.themes : []
        const defaultTheme = themes.find((t: { isDefault?: boolean }) => t.isDefault) ?? themes[0] ?? null
        setBrand({
          timezone: b.timezone ?? 'UTC',
          memberCount,
          // R30c — preview pane substitutes {{brand_name}} + {{brand_logo}}.
          name: b.name ?? '',
          logoUrl: b.logoUrl ?? null,
          theme: defaultTheme
            ? {
                primaryColor: defaultTheme.primaryColor ?? '#6366f1',
                backgroundColor: defaultTheme.backgroundColor ?? '#ffffff',
                textColor: defaultTheme.textColor ?? '#111827',
                accentColor: defaultTheme.accentColor ?? '#6366f1',
                buttonColor: defaultTheme.buttonColor ?? '#6366f1',
                buttonTextColor: defaultTheme.buttonTextColor ?? '#ffffff',
                fontFamily: defaultTheme.fontFamily ?? 'system-ui',
              }
            : null,
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

  // F16 — composer validity recomputed live so the Send button can disable
  // immediately when the operator removes a required token (e.g. {{survey_link}})
  // and the inline error appears without requiring a click-through attempt.
  const liveComposerError = validateComposer()
  useEffect(() => {
    setComposerError(liveComposerError)
  }, [liveComposerError])

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
        // F9 — surface the API's field-level Zod errors (when present) so the
        // operator sees what specifically failed instead of just "Validation
        // failed". The route exposes `fieldErrors: Record<string, string[]>`
        // on the 422 response. Flatten the first error per field for display.
        const fe = err.fieldErrors as Record<string, string[]> | undefined
        const detail = fe
          ? Object.entries(fe)
              .flatMap(([field, msgs]) => msgs.map((m) => `${field}: ${m}`))
              .slice(0, 4)
              .join(' · ')
          : null
        const headline = err.error ?? `Send failed (${res.status})`
        throw new Error(detail ? `${headline} — ${detail}` : headline)
      }
      const data = await res.json()
      setBatchId(data.batchId)
      setFlow('sending')
    } catch (err) {
      // F9 — keep flow at 'confirm' so the configure UI doesn't get unmounted
      // (which would blow away the audience-builder's internal state). The
      // modal closes itself on error via the submitError surface, but the
      // form behind it stays mounted with selections + composer intact.
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
      <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <a href="/admin/surveys" className="hover:text-indigo-700 hover:underline">
              Surveys
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <a href={`/admin/surveys/${surveyId}`} className="hover:text-indigo-700 hover:underline">
              {survey.title ?? survey.name}
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="font-medium text-gray-700">
            Distribute
          </li>
        </ol>
      </nav>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-600">Send via CustomerEQ</p>
          <h1 className="text-2xl font-semibold text-gray-900">{survey.title ?? survey.name}</h1>
        </div>
        {/* G6 — mode-switch only makes sense while still configuring; once
            the operator has clicked Send (flow → 'confirm' / 'sending' /
            'sent'), switching modes mid-batch is nonsensical and would lose
            the in-flight send state. Hide the toggle for those states. */}
        {flow === 'configure' && (
          <button
            type="button"
            onClick={() => switchTo('self-serve')}
            className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Switch to my email tool →
          </button>
        )}
      </header>

      {/* F9 — submit-error is rendered at the top so it's always visible after
          a send failure (was previously wedged between the editor section and
          the recap panel). */}
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="managed-email-submit-error"
        >
          <p className="font-medium">Send failed</p>
          <p className="mt-1">{submitError}</p>
        </div>
      )}

      {/* F9 — the configure subtree stays MOUNTED through 'confirm' / 'sending'
          / 'sent' (visibility-toggled via CSS) so the AudienceBuilder's internal
          state (selected rows, search results, pasted lists) is preserved when
          the operator cancels the confirm modal or the API rejects the send.
          Previously the conditional `{flow === 'configure' && ...}` unmount
          blew this state away on every flow transition. */}
      <div className={flow === 'configure' || flow === 'confirm' ? '' : 'hidden'}>
        <div className="space-y-6">
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
            <div className="mb-2">
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

          {/* Composer + Live preview — mock #scene-3 lines 673–800 +
              spec R30a (right-column preview pane) + R30b (sample recipient
              = first selected audience member) + R30d (keystroke-driven
              live update). Layout: composer left, sticky preview right. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="mb-3">
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
                        @{SENDER_DOMAIN}
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

            <EmailPreviewCard
              senderName={senderName}
              senderAlias={senderAlias}
              senderDomain={SENDER_DOMAIN}
              subject={subject}
              bodyHtml={body}
              sampleRecipient={
                // R30b — first selected audience member; preview falls back
                // to a generic placeholder when no audience exists yet.
                audience?.rows.find((r) => r.selected)
                  ? {
                      firstName:
                        audience.rows.find((r) => r.selected)!.firstName ?? null,
                      lastName: audience.rows.find((r) => r.selected)!.lastName ?? null,
                      identifier: audience.rows.find((r) => r.selected)!.identifier,
                    }
                  : null
              }
              brandName={brand.name}
              brandLogoUrl={brand.logoUrl}
              surveyTitle={survey.title ?? survey.name}
              surveyId={surveyId}
              theme={brand.theme}
            />
          </div>

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
              disabled={!audience || audience.selectedCount === 0 || Boolean(liveComposerError)}
              title={liveComposerError ?? undefined}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send {audience?.selectedCount ?? 0} emails →
            </button>
          </div>
        </div>
      </div>

      {/* Mock #scene-4 lines 835–849 — MANAGED_EMAIL confirmation modal.
          Spec R32a (centered modal with backdrop, NOT inline section) +
          R32b (mode-specific heading "⚠ Send N emails?" with CustomerEQ
          Email tag) + R32c (summary block: From / Subject / Survey name
          in mail / Links expire / Recipients(+auto-enroll)) + R32e
          (informational sub-warning "you cannot cancel a send in
          progress") + R32f (Cancel + Yes-send-N). */}
      {flow === 'confirm' && (
        <ManagedEmailConfirmModal
          senderName={senderName}
          senderAlias={senderAlias}
          subject={subject}
          surveyNameInMail={surveyNameInMail}
          expiresAtIso={expiresAtIso}
          brandTimezone={brand.timezone}
          selectedCount={audience?.selectedCount ?? 0}
          willAutoEnrollCount={audience?.willAutoEnrollCount ?? 0}
          submitting={submitting}
          onCancel={() => setFlow('configure')}
          onConfirm={handleConfirmSend}
        />
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

interface ManagedEmailConfirmModalProps {
  senderName: string
  senderAlias: string
  subject: string
  surveyNameInMail: string
  expiresAtIso: string
  brandTimezone: string
  selectedCount: number
  willAutoEnrollCount: number
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ManagedEmailConfirmModal({
  senderName,
  senderAlias,
  subject,
  surveyNameInMail,
  expiresAtIso,
  brandTimezone,
  selectedCount,
  willAutoEnrollCount,
  submitting,
  onCancel,
  onConfirm,
}: ManagedEmailConfirmModalProps) {
  const fromAddress = `${senderAlias}@customereq.wellnessatwork.me`
  const expiresFormatted = new Date(expiresAtIso).toLocaleString(undefined, {
    timeZone: brandTimezone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="managed-confirm-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      data-testid="managed-email-confirm-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          {/* R32b — mode-specific heading with CustomerEQ Email tag. */}
          <h3
            id="managed-confirm-heading"
            className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900"
          >
            <span>
              ⚠ Send {selectedCount} email{selectedCount === 1 ? '' : 's'}?
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              CustomerEQ Email
            </span>
          </h3>
        </div>
        <div className="space-y-4 px-5 py-4">
          {/* R32c — summary block contents per mock lines 837–843. */}
          <dl className="space-y-1.5 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-gray-900">From:</dt>
              <dd className="break-all text-gray-700">
                {senderName || '—'}{' '}
                <span className="font-mono text-gray-500">&lt;{fromAddress}&gt;</span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Subject:</dt>
              <dd className="text-gray-700">{subject || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Survey name in mail:</dt>
              <dd className="text-gray-700">{surveyNameInMail || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Links expire:</dt>
              <dd className="text-gray-700">{expiresFormatted}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Recipients:</dt>
              <dd className="text-gray-700">
                {selectedCount} selected member{selectedCount === 1 ? '' : 's'}
                {willAutoEnrollCount > 0 ? (
                  <span className="ml-1 text-gray-500">
                    ({willAutoEnrollCount} auto-enroll)
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
          {/* R32e — informational sub-warning (mock line 844). */}
          <p className="text-xs text-gray-600">
            Emails will be sent in the next few minutes. You can monitor progress on the next
            screen but <strong className="text-gray-900">you cannot cancel a send in progress</strong>.
          </p>
        </div>
        {/* R32f — Cancel + primary-confirm, with mode-specific confirm copy. */}
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            data-testid="managed-email-confirm-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            data-testid="managed-email-confirm-yes"
          >
            {submitting
              ? 'Dispatching…'
              : `Yes, send ${selectedCount} email${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

