// Issue #378 — Self-serve distribution flow (operator generates per-recipient
// links and downloads a CSV their own email tool will mail-merge).
//
// Issue #420 — refactored to mount the shared <SurveyBatchDetailsCard> + the
// shared <AudienceBuilder> above the mode-specific format/Generate area
// (spec §2 "Define batch attributes → Select members → Send" ordering;
// audience builder lift per R16/R18/R20/R22/R23/R43). Submission encodes the
// accumulated audience as a custom_list paste of the selected rows'
// identifiers — the backend re-resolves them at Generate time using the
// existing resolveCustomList path, so #378's atomic-write semantics and
// audit-log shape are preserved unchanged.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'
import { useModeRouter } from '@/components/mode-router'

import { presetToIsoExpiry } from './expiry'
import type { DistributeMode } from './modes'
import {
  SurveyBatchDetailsCard,
  type ExpiryPreset,
} from './SurveyBatchDetailsCard'
import {
  AudienceBuilder,
  type AudienceBuilderState,
} from './audience-builder'

type DistributionFormat = 'generic' | 'mailchimp' | 'hubspot' | 'klaviyo'

interface GenerateResponse {
  batchId: string
  label: string
  expiresAt: string
  tokenCount: number
  autoEnrolledMemberIds: string[]
  unmatched: string[]
  tokens: {
    memberId: string
    identifier: string
    firstName: string | null
    lastName: string | null
    plaintext: string
  }[]
}

interface SurveyContext {
  id: string
  title: string | null
  name: string
  status: string
}

interface BrandContext {
  timezone: string
  locale: string
  memberIdentifierKind: 'email' | 'phone' | 'external_id'
  memberCount: number
}

function formatDistributionTzDate(iso: string, timezone: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return new Date(iso).toISOString()
  }
}

function brandKindToClient(
  raw: string | undefined,
): 'email' | 'phone' | 'external_id' {
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

function identifierHeaderFor(
  format: DistributionFormat,
  kind: 'email' | 'phone' | 'external_id',
): string {
  if (format === 'mailchimp') {
    return { email: 'Email Address', phone: 'Phone Number', external_id: 'Customer ID' }[kind]
  }
  if (format === 'hubspot') {
    return { email: 'email', phone: 'phone_number', external_id: 'customer_id' }[kind]
  }
  if (format === 'klaviyo') {
    return { email: 'Email', phone: 'Phone Number', external_id: 'Customer ID' }[kind]
  }
  return { email: 'Email', phone: 'Phone Number', external_id: 'Customer ID' }[kind]
}

function csvForFormat(
  format: DistributionFormat,
  rows: GenerateResponse['tokens'],
  surveyNameInMail: string,
  baseUrl: string,
  surveyId: string,
  memberIdentifierKind: 'email' | 'phone' | 'external_id',
): string {
  const idHeader = identifierHeaderFor(format, memberIdentifierKind)
  const headers = {
    generic: [idHeader, 'firstName', 'lastName', 'surveyName', 'mergeTagUrl'],
    mailchimp: [idHeader, 'FNAME', 'LNAME', 'SURVEY_NAME', 'SURVEY_URL'],
    hubspot: [idHeader, 'firstname', 'lastname', 'survey_name', 'survey_url'],
    klaviyo: [idHeader, 'First Name', 'Last Name', 'Survey Name', 'Survey URL'],
  }[format]
  const escape = (s: string | null): string => {
    if (s === null || s === undefined) return ''
    const v = String(s)
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    const url = `${baseUrl}/survey/${surveyId}/r/${row.plaintext}`
    lines.push(
      [row.identifier, row.firstName, row.lastName, surveyNameInMail, url].map(escape).join(','),
    )
  }
  return lines.join('\n') + '\n'
}

function downloadCsv(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SelfServeFlow() {
  const params = useParams<{ id: string }>()
  const surveyId = params.id
  const { getToken } = useAuth()
  const { switchTo } = useModeRouter<DistributeMode>()

  const [survey, setSurvey] = useState<SurveyContext | null>(null)
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [surveyNameInMail, setSurveyNameInMail] = useState<string>('')
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('7d')
  const [customExpiry, setCustomExpiry] = useState<string>('')

  const [audience, setAudience] = useState<AudienceBuilderState | null>(null)

  const [generating, setGenerating] = useState<boolean>(false)
  const [generated, setGenerated] = useState<GenerateResponse | null>(null)

  // F6 — beforeunload guard + in-app click intercept while there's unsaved
  // configure work and the operator hasn't yet generated the CSV. Same shape
  // as the ManagedEmailFlow sibling: capture-phase document click listener
  // beats React's synthetic dispatch so we can preventDefault on Next Link
  // soft-nav (sidebar, breadcrumb, etc.). Full state preservation across nav
  // is a separate follow-up.
  const audienceSelectedCount = audience?.selectedCount ?? 0
  const selfServeDirty =
    !generated && (audienceSelectedCount > 0 || surveyNameInMail.trim() !== '')
  useEffect(() => {
    if (!selfServeDirty) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const clickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
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
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      const ok = window.confirm('You have unsaved changes in this distribution. Leave anyway?')
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
  }, [selfServeDirty])
  const [genError, setGenError] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<DistributionFormat>('generic')
  // Spec R32a + mock #scene-4 lines 818-833 — confirmation modal gates the
  // Generate-N-links commit so the operator sees the recap + strong-warning
  // (R32c + R32d) and can cancel before tokens are minted. Clicking the
  // Generate CTA opens this modal; the modal's "Yes" calls handleGenerate.
  const [showConfirm, setShowConfirm] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function loadContext() {
      const token = await getAuthToken(getToken)
      if (!token) {
        setLoadError('Not authenticated.')
        return
      }
      try {
        const [surveyRes, brandRes, memberCountRes] = await Promise.all([
          fetch(`${API_URL}/v1/surveys/${surveyId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/v1/admin/brand/profile`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/v1/members?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (!surveyRes.ok) throw new Error(`Survey load failed: ${surveyRes.status}`)
        if (!brandRes.ok) throw new Error(`Brand profile load failed: ${brandRes.status}`)
        const surveyBody = await surveyRes.json()
        const brandBody = await brandRes.json()
        let memberCount = 0
        if (memberCountRes.ok) {
          const mb = await memberCountRes.json()
          memberCount = mb.total ?? 0
        }
        if (cancelled) return
        setSurvey({
          id: surveyBody.id,
          title: surveyBody.title ?? null,
          name: surveyBody.name,
          status: surveyBody.status,
        })
        // /v1/admin/brand/profile wraps the brand under `brand` (see
        // apps/api/src/routes/admin-brand-profile.ts). Reading brandBody.*
        // directly silently fell through to defaults.
        const b = brandBody.brand ?? brandBody
        setBrand({
          timezone: b.timezone ?? 'UTC',
          locale: b.locale ?? 'en-US',
          memberIdentifierKind: brandKindToClient(b.memberIdentifierKind),
          memberCount,
        })
        setSurveyNameInMail(surveyBody.title ?? surveyBody.name)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message)
      }
    }
    void loadContext()
    return () => {
      cancelled = true
    }
  }, [surveyId, getToken])

  const expiresAtIso =
    expiryPreset === 'custom'
      ? customExpiry || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      : presetToIsoExpiry(expiryPreset, brand?.timezone ?? 'UTC')

  const handleGenerate = useCallback(async () => {
    if (!survey || !brand || !audience) return
    if (!surveyNameInMail.trim()) return
    if (audience.selectedCount < 1) return
    setShowConfirm(false)
    setGenerating(true)
    setGenError(null)
    try {
      const token = await getAuthToken(getToken)
      if (!token) {
        setGenError('Not authenticated.')
        return
      }
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          surveyNameInMail,
          expiresAt: expiresAtIso,
          audience: audience.submitAudience,
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        setGenError(errBody.error ?? errBody.code ?? `Failed (${res.status})`)
        return
      }
      const genBody = (await res.json()) as GenerateResponse
      setGenerated(genBody)
    } catch (err) {
      setGenError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [survey, brand, audience, surveyNameInMail, expiresAtIso, surveyId, getToken])

  const handleDownload = useCallback(() => {
    if (!generated || !survey || !brand) return
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : ''
    const csv = csvForFormat(
      downloadFormat,
      generated.tokens,
      surveyNameInMail,
      baseUrl,
      surveyId,
      brand.memberIdentifierKind,
    )
    const safeName = (survey.name || 'survey').replace(/[^A-Za-z0-9-]/g, '-')
    const yyyymmdd = new Date().toISOString().slice(0, 10)
    downloadCsv(`${safeName}-${yyyymmdd}-links.csv`, csv)
  }, [generated, downloadFormat, surveyNameInMail, survey, brand, surveyId])

  if (loadError) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-red-600">Error loading distribute page: {loadError}</p>
        <a href={`/admin/surveys/${surveyId}`} className="text-indigo-600 hover:underline">
          ← Back to survey
        </a>
      </main>
    )
  }
  if (!survey || !brand) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-gray-500">Loading…</p>
      </main>
    )
  }

  if (generated) {
    return (
      <SuccessState
        generated={generated}
        brand={brand}
        survey={survey}
        downloadFormat={downloadFormat}
        setDownloadFormat={setDownloadFormat}
        onDownload={handleDownload}
        onBack={() => {
          window.location.href = `/admin/surveys/${surveyId}`
        }}
      />
    )
  }

  const ctaDisabled =
    generating ||
    !surveyNameInMail.trim() ||
    !audience ||
    audience.selectedCount < 1

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <a href="/admin/surveys" className="hover:text-indigo-700 hover:underline">
              Surveys
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <a href={`/admin/surveys/${surveyId}`} className="hover:text-indigo-700 hover:underline">
              {survey?.title ?? survey?.name ?? 'Survey'}
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="font-medium text-gray-700">
            Distribute
          </li>
        </ol>
      </nav>
      <header className="mb-6">
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Send via my email tool
              <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Self-serve
              </span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Build your audience, set common fields, then download per-recipient links your
              email tool can mail-merge.
            </p>
          </div>
          <button
            type="button"
            onClick={() => switchTo('managed-email')}
            className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Switch to Send via CustomerEQ →
          </button>
        </div>
      </header>

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

        {/* MODE-SPECIFIC: SELF_SERVE format dropdown sits above the Generate CTA */}
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
              Mode-specific · Self-serve
            </span>
            <h2 className="text-sm font-semibold text-gray-900">Download format</h2>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">CSV column-header format</span>
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value as DistributionFormat)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="generic">Generic</option>
              <option value="mailchimp">Mailchimp</option>
              <option value="hubspot">HubSpot</option>
              <option value="klaviyo">Klaviyo</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-amber-800">
            The CSV&apos;s column headers + <code>mergeTagUrl</code> wrapping are tuned to the
            chosen format. You can re-pick the format on the Success state for re-download.
          </p>
        </section>

        {genError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {genError}
          </div>
        ) : null}

        {/* Mock #scene-2 line 530 — pre-submit recap so the operator can scan
            wave + expiry + format before committing. Spec R31a. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-700" data-testid="self-serve-pre-submit-recap">
            Ready to generate{' '}
            <strong className="text-gray-900">
              {audience?.selectedCount ?? 0} link{audience?.selectedCount === 1 ? '' : 's'}
            </strong>
            . Survey name: <strong className="text-gray-900">{surveyNameInMail || '—'}</strong>.
            Expires{' '}
            <strong className="text-gray-900">
              {formatDistributionTzDate(expiresAtIso, brand.timezone, brand.locale)}
            </strong>
            . Format: <strong className="text-gray-900 capitalize">{downloadFormat}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={ctaDisabled}
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating
              ? `Generating ${audience?.selectedCount ?? 0} links…`
              : `Generate ${audience?.selectedCount ?? 0} links →`}
          </button>
        </div>
      </div>

      {/* Mock #scene-4 lines 818–833 — SELF_SERVE confirmation modal.
          Spec R32a (centered modal + backdrop) + R32b (mode-specific heading
          with Self-Serve tag) + R32c (summary block with Survey name / Links
          expire / Format / Recipients(+auto-enroll)) + R32d (strong-warning
          amber block) + R32f (Cancel + primary-confirm). */}
      {showConfirm && audience && brand ? (
        <SelfServeConfirmModal
          surveyNameInMail={surveyNameInMail}
          expiresAtIso={expiresAtIso}
          brandTimezone={brand.timezone}
          brandLocale={brand.locale}
          downloadFormat={downloadFormat}
          selectedCount={audience.selectedCount}
          willAutoEnrollCount={audience.willAutoEnrollCount}
          generating={generating}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleGenerate}
        />
      ) : null}
    </main>
  )
}

interface SelfServeConfirmModalProps {
  surveyNameInMail: string
  expiresAtIso: string
  brandTimezone: string
  brandLocale: string
  downloadFormat: DistributionFormat
  selectedCount: number
  willAutoEnrollCount: number
  generating: boolean
  onCancel: () => void
  onConfirm: () => void
}

function SelfServeConfirmModal({
  surveyNameInMail,
  expiresAtIso,
  brandTimezone,
  brandLocale,
  downloadFormat,
  selectedCount,
  willAutoEnrollCount,
  generating,
  onCancel,
  onConfirm,
}: SelfServeConfirmModalProps) {
  const formatLabel = downloadFormat.charAt(0).toUpperCase() + downloadFormat.slice(1)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-serve-confirm-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      data-testid="self-serve-confirm-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          {/* R32b — mode-specific heading with Self-Serve tag. */}
          <h3
            id="self-serve-confirm-heading"
            className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900"
          >
            <span>
              ⚠ Generate {selectedCount} tokenized link{selectedCount === 1 ? '' : 's'}?
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Self-Serve
            </span>
          </h3>
        </div>
        <div className="space-y-4 px-5 py-4">
          {/* R32c — summary block contents per mock lines 820–825. */}
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Survey name in mail:</dt>
              <dd className="text-gray-700">{surveyNameInMail || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Links expire:</dt>
              <dd className="text-gray-700">
                {formatDistributionTzDate(expiresAtIso, brandTimezone, brandLocale)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-900">Format:</dt>
              <dd className="text-gray-700">{formatLabel}</dd>
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
          {/* R32d — strong-warning amber block (mock line 827). */}
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <strong>⚠ The plaintext URLs are shown only once.</strong> Save the CSV immediately.
            Re-downloading later requires regenerating all tokens (which invalidates the URLs in
            this batch).
          </div>
        </div>
        {/* R32f — Cancel + primary-confirm, with mode-specific confirm copy. */}
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={generating}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            data-testid="self-serve-confirm-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={generating}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            data-testid="self-serve-confirm-yes"
          >
            {generating
              ? 'Generating…'
              : `Yes, generate ${selectedCount} link${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function SuccessState({
  generated,
  brand,
  survey,
  downloadFormat,
  setDownloadFormat,
  onDownload,
  onBack,
}: {
  generated: GenerateResponse
  brand: BrandContext
  survey: SurveyContext
  downloadFormat: DistributionFormat
  setDownloadFormat: (f: DistributionFormat) => void
  onDownload: () => void
  onBack: () => void
}) {
  const expiryDisplay = formatDistributionTzDate(generated.expiresAt, brand.timezone, brand.locale)
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-900">
          ✓ Generated {generated.tokenCount} links — {generated.label}. Tokens expire {expiryDisplay}.
        </p>
      </div>
      <p className="mt-3 text-sm text-gray-700">
        Users will be able to respond only once in this wave. A leaked or re-clicked link gets the
        &quot;already submitted&quot; state.
      </p>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">⚠ Save this CSV now.</p>
        <p className="mt-1">
          The plaintext URLs are shown only once. Re-downloading later requires regenerating all
          tokens — which invalidates the URLs in this batch.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-xs font-medium text-gray-700">
          Format:{' '}
          <select
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value as DistributionFormat)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="generic">Generic</option>
            <option value="mailchimp">Mailchimp</option>
            <option value="hubspot">HubSpot</option>
            <option value="klaviyo">Klaviyo</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onDownload}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          ⬇ Download CSV
        </button>
      </div>

      {/* Mock #scene-5a line 916 — Done is the page's terminal primary CTA. */}
      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Done — back to survey →
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Batch ID: <code className="font-mono">{generated.batchId}</code> — see batch detail at{' '}
        <a
          href={`/admin/surveys/${survey.id}/distribute/batches/${generated.batchId}`}
          className="text-indigo-600 hover:underline"
        >
          /admin/surveys/{survey.id}/distribute/batches/{generated.batchId}
        </a>
      </p>
    </main>
  )
}
