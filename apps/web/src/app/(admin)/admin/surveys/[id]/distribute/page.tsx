// Issue #378 — Distribute page: single short page (spec §2).
// Two visual states on the same route: Configure → Success. The transition
// is in-place after the operator clicks Generate.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'

type AudienceMode = 'existing_members' | 'custom_list'
type DistributionFormat = 'generic' | 'mailchimp' | 'hubspot' | 'klaviyo'

interface PreviewResponse {
  audienceCount: number
  willAutoEnrollCount: number
  unmatchedCount: number
  members: {
    memberId: string | null
    identifier: string
    firstName: string | null
    lastName: string | null
    lastResponseThisSurvey: string | null
    lastResponseAnySurvey: string | null
    willAutoEnroll?: boolean
  }[]
  unmatched: string[]
  totalRows: number
}

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

// Map the API's UPPERCASE enum (EMAIL / PHONE / CUSTOMER_ID) to the lowercase
// form the client uses. The previous inline `.toLowerCase().replace('_', '_')`
// was a no-op that left CUSTOMER_ID brands with an invalid `customer_id` value
// at runtime even though the type said `external_id`.
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

function presetToIsoExpiry(preset: '24h' | '7d' | '30d' | '90d', _timezone: string): string {
  // Caller passes brand timezone for end-of-day snap; server re-validates.
  // For V0 the client computes a UTC offset from now() rounded to the next
  // 23:59 in the brand's wall-clock. We approximate by adding the preset
  // duration to now and snapping to 23:59 UTC — the server is authoritative
  // for the EOD-in-brand-TZ semantic per RFC §datetime.
  const now = new Date()
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[preset]
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + days)
  target.setUTCHours(23, 59, 59, 999)
  return target.toISOString()
}

// Per-platform identifier-column header keyed off the brand's Member ID type
// (issue #378 walk-through feedback #10 — drop internal `memberId` from the
// customer-facing CSV; rename the identifier column using the brand's term).
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
  // generic — match the brand's wording as surfaced in Organization → Settings.
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

export default function DistributePage() {
  const params = useParams<{ id: string }>()
  const surveyId = params.id
  const { getToken } = useAuth()

  const [survey, setSurvey] = useState<SurveyContext | null>(null)
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<AudienceMode>('existing_members')
  const [strategy, setStrategy] = useState<'percent' | 'count'>('count')
  const [strategyValue, setStrategyValue] = useState<number>(100)
  const [pasteBody, setPasteBody] = useState<string>('')
  const [autoEnroll, setAutoEnroll] = useState<boolean>(true)
  const [surveyNameInMail, setSurveyNameInMail] = useState<string>('')
  const [expiryPreset, setExpiryPreset] = useState<'24h' | '7d' | '30d' | '90d' | 'custom'>('7d')
  const [customExpiry, setCustomExpiry] = useState<string>('')

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState<boolean>(false)
  const [generating, setGenerating] = useState<boolean>(false)
  const [generated, setGenerated] = useState<GenerateResponse | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<DistributionFormat>('generic')

  // ── Load survey + brand context on mount.
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
        setBrand({
          timezone: brandBody.timezone ?? 'UTC',
          locale: brandBody.locale ?? 'en-US',
          memberIdentifierKind: brandKindToClient(brandBody.memberIdentifierKind),
          memberCount,
        })
        // Default survey-name-in-mail to respondent-facing title (R10).
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

  // ── Auto-refresh preview when inputs change (debounced).
  // Uses AbortController so a slow in-flight preview can't land after a newer
  // one and revert the UI to a stale count (issue #378 walk-through #7 — user
  // changed Count to 0 but the preview still showed the previous value).
  useEffect(() => {
    if (!survey || !brand || generated) return
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      const token = await getAuthToken(getToken)
      if (!token) return
      setPreviewing(true)
      try {
        const body =
          mode === 'existing_members'
            ? {
                surveyNameInMail: surveyNameInMail || survey.title || survey.name,
                expiresAt:
                  expiryPreset === 'custom'
                    ? customExpiry || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
                    : presetToIsoExpiry(expiryPreset, brand.timezone),
                audience: {
                  mode: 'existing_members' as const,
                  strategy,
                  value: strategyValue || 0,
                },
              }
            : {
                surveyNameInMail: surveyNameInMail || survey.title || survey.name,
                expiresAt:
                  expiryPreset === 'custom'
                    ? customExpiry || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
                    : presetToIsoExpiry(expiryPreset, brand.timezone),
                audience: { mode: 'custom_list' as const, identifiers: pasteBody, autoEnroll },
              }
        const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (res.ok) {
          const previewBody = (await res.json()) as PreviewResponse
          if (!controller.signal.aborted) setPreview(previewBody)
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        // Soft-fail — preview is best-effort.
      } finally {
        if (!controller.signal.aborted) setPreviewing(false)
      }
    }, 250)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [
    survey,
    brand,
    mode,
    strategy,
    strategyValue,
    pasteBody,
    autoEnroll,
    surveyNameInMail,
    expiryPreset,
    customExpiry,
    generated,
    surveyId,
    getToken,
  ])

  const handleGenerate = useCallback(async () => {
    if (!survey || !brand) return
    if (!surveyNameInMail.trim()) return
    if ((preview?.audienceCount ?? 0) < 1) return
    setGenerating(true)
    setGenError(null)
    try {
      const token = await getAuthToken(getToken)
      if (!token) {
        setGenError('Not authenticated.')
        return
      }
      const body =
        mode === 'existing_members'
          ? {
              surveyNameInMail,
              expiresAt:
                expiryPreset === 'custom' ? customExpiry : presetToIsoExpiry(expiryPreset, brand.timezone),
              audience: { mode: 'existing_members' as const, strategy, value: strategyValue },
            }
          : {
              surveyNameInMail,
              expiresAt:
                expiryPreset === 'custom' ? customExpiry : presetToIsoExpiry(expiryPreset, brand.timezone),
              audience: { mode: 'custom_list' as const, identifiers: pasteBody, autoEnroll },
            }
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/distribution-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
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
  }, [
    survey,
    brand,
    surveyNameInMail,
    mode,
    strategy,
    strategyValue,
    pasteBody,
    autoEnroll,
    expiryPreset,
    customExpiry,
    surveyId,
    getToken,
    preview,
  ])

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
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-red-600">Error loading distribute page: {loadError}</p>
        <a href={`/admin/surveys/${surveyId}`} className="text-indigo-600 hover:underline">
          ← Back to survey
        </a>
      </main>
    )
  }
  if (!survey || !brand) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
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

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-6">
        <a href={`/admin/surveys/${surveyId}`} className="text-sm text-indigo-600 hover:underline">
          ← Back to survey
        </a>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Send via my email tool</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate per-recipient links and download a CSV your email tool can mail-merge.
        </p>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Who gets this survey?</h2>
          <ModeChooser
            mode={mode}
            setMode={setMode}
            brandMemberCount={brand.memberCount}
            strategy={strategy}
            setStrategy={setStrategy}
            strategyValue={strategyValue}
            setStrategyValue={setStrategyValue}
            pasteBody={pasteBody}
            setPasteBody={setPasteBody}
            autoEnroll={autoEnroll}
            setAutoEnroll={setAutoEnroll}
          />
        </div>

        <CommonFields
          surveyNameInMail={surveyNameInMail}
          setSurveyNameInMail={setSurveyNameInMail}
          expiryPreset={expiryPreset}
          setExpiryPreset={setExpiryPreset}
          customExpiry={customExpiry}
          setCustomExpiry={setCustomExpiry}
          brandTimezone={brand.timezone}
        />

        <LivePreview preview={preview} previewing={previewing} mode={mode} brand={brand} />

        {genError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {genError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              generating ||
              !surveyNameInMail.trim() ||
              (preview?.audienceCount ?? 0) < 1
            }
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating
              ? `Generating ${preview?.audienceCount ?? 0} links…`
              : `Generate ${preview?.audienceCount ?? 0} links`}
          </button>
        </div>
      </section>
    </main>
  )
}

// ─── Configure-state subcomponents ────────────────────────────────────────────

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-md border border-gray-300"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ExistingMembersBody({
  brandMemberCount,
  strategy,
  setStrategy,
  strategyValue,
  setStrategyValue,
}: {
  brandMemberCount: number
  strategy: 'percent' | 'count'
  setStrategy: (s: 'percent' | 'count') => void
  strategyValue: number
  setStrategyValue: (n: number) => void
}) {
  // String-backed input state so the user can transiently clear or edit
  // without the displayed value snapping back through Number coercion.
  // Addresses #378 walk-through #6 ("can't remove leading zero") and #5
  // (count cap enforced as the user types, not just on submit).
  const [raw, setRaw] = useState<string>(String(strategyValue))
  const max = strategy === 'percent' ? 100 : Math.max(0, brandMemberCount)
  useEffect(() => {
    // Keep the input in sync when strategy or brandMemberCount changes
    // upstream (e.g. switching Percent → Count clamps the active value).
    setRaw(String(strategyValue))
  }, [strategyValue, strategy])
  const helper =
    strategy === 'percent'
      ? `Percent of all eligible non-ERASED members (max ${brandMemberCount} total).`
      : `Max ${brandMemberCount.toLocaleString()} (all eligible non-ERASED members).`
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedToggle
          ariaLabel="Sampling strategy"
          options={[
            { value: 'percent', label: 'Percent' },
            { value: 'count', label: 'Count' },
          ]}
          value={strategy}
          onChange={setStrategy}
        />
        <input
          type="number"
          min={0}
          max={max}
          value={raw}
          inputMode="numeric"
          onChange={(e) => {
            const next = e.target.value
            setRaw(next)
            if (next === '') {
              setStrategyValue(0)
              return
            }
            const parsed = Number.parseInt(next, 10)
            if (Number.isNaN(parsed)) return
            const clamped = Math.min(Math.max(0, parsed), max)
            setStrategyValue(clamped)
            // If the user typed a number above the cap, snap the displayed
            // value too so they see the enforced ceiling immediately.
            if (clamped !== parsed) setRaw(String(clamped))
          }}
          onBlur={() => {
            if (raw === '' || Number.isNaN(Number.parseInt(raw, 10))) setRaw('0')
          }}
          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-gray-500">{strategy === 'percent' ? '%' : 'members'}</span>
      </div>
      <p className="text-xs text-gray-500">{helper}</p>
    </div>
  )
}

function CustomListBody({
  pasteBody,
  setPasteBody,
  autoEnroll,
  setAutoEnroll,
}: {
  pasteBody: string
  setPasteBody: (s: string) => void
  autoEnroll: boolean
  setAutoEnroll: (b: boolean) => void
}) {
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)
  return (
    <div className="mt-3 space-y-3">
      <SegmentedToggle
        ariaLabel="Custom list input mode"
        options={[
          { value: 'paste', label: 'Paste' },
          { value: 'upload', label: '⤓ Upload CSV' },
        ]}
        value={inputMode}
        onChange={(v) => {
          setInputMode(v)
          setUploadError(null)
        }}
      />
      {inputMode === 'paste' ? (
        <>
          <textarea
            value={pasteBody}
            onChange={(e) => {
              setPasteBody(e.target.value)
              if (uploadedFilename) setUploadedFilename(null)
            }}
            placeholder="jane@example.com&#10;Jane Mitchell <bob@example.com>&#10;+15551234567"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
            rows={6}
          />
          <p className="text-[11px] text-gray-500">
            Up to 10,000 entries · separate with newline, comma, or semicolon · also accepts{' '}
            <code className="rounded bg-gray-100 px-1">Name &lt;email&gt;</code> form.
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setUploadError(null)
                if (file.size > 10 * 1024 * 1024) {
                  setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB; max 10 MB.`)
                  return
                }
                try {
                  const text = await file.text()
                  setPasteBody(text)
                  setUploadedFilename(file.name)
                } catch (err) {
                  setUploadError(`Could not read file: ${(err as Error).message}`)
                }
              }}
            />
            Choose CSV file…
          </label>
          {uploadedFilename ? (
            <p className="text-xs text-gray-600">
              Loaded <span className="font-mono">{uploadedFilename}</span> ·{' '}
              {pasteBody.length.toLocaleString()} chars. The CSV header row is auto-detected
              (recognised column names: <code>email</code>, <code>phone</code>,{' '}
              <code>customer_id</code>, <code>first_name</code>, <code>last_name</code>).
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              CSV header row is auto-detected. Recognised columns: <code>email</code>,{' '}
              <code>phone</code>, <code>customer_id</code>, <code>first_name</code>,{' '}
              <code>last_name</code>. Max 10 MB / 100,000 rows.
            </p>
          )}
          {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={autoEnroll}
          onChange={(e) => setAutoEnroll(e.target.checked)}
        />
        Auto-enroll members not in this brand
      </label>
    </div>
  )
}

function ModeChooser({
  mode,
  setMode,
  brandMemberCount,
  strategy,
  setStrategy,
  strategyValue,
  setStrategyValue,
  pasteBody,
  setPasteBody,
  autoEnroll,
  setAutoEnroll,
}: {
  mode: AudienceMode
  setMode: (m: AudienceMode) => void
  brandMemberCount: number
  strategy: 'percent' | 'count'
  setStrategy: (s: 'percent' | 'count') => void
  strategyValue: number
  setStrategyValue: (n: number) => void
  pasteBody: string
  setPasteBody: (s: string) => void
  autoEnroll: boolean
  setAutoEnroll: (b: boolean) => void
}) {
  // Two cards side-by-side on one row (#378 walk-through #4 — match mock layout
  // at docs/feature-specs/mocks/378-distribute-flow.html scene 2 mode-grid).
  // Collapses to one column on small screens so the body stays usable on mobile.
  const showExisting = brandMemberCount > 0
  return (
    <div
      className={`grid grid-cols-1 gap-3 ${showExisting ? 'sm:grid-cols-2' : ''}`}
      role="radiogroup"
      aria-label="Audience mode"
    >
      {showExisting ? (
        <label
          className={`block cursor-pointer rounded-lg border-2 p-4 transition-colors ${
            mode === 'existing_members'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="audience-mode"
            checked={mode === 'existing_members'}
            onChange={() => setMode('existing_members')}
            className="sr-only"
          />
          <p className="text-sm font-medium text-gray-900">
            Existing Members{' '}
            <span className="font-normal text-gray-500">· {brandMemberCount.toLocaleString()} total</span>
          </p>
          <p className="mt-1 text-xs text-gray-600">Random sample from your member roster.</p>
          {mode === 'existing_members' ? (
            <ExistingMembersBody
              brandMemberCount={brandMemberCount}
              strategy={strategy}
              setStrategy={setStrategy}
              strategyValue={strategyValue}
              setStrategyValue={setStrategyValue}
            />
          ) : null}
        </label>
      ) : null}
      <label
        className={`block cursor-pointer rounded-lg border-2 p-4 transition-colors ${
          mode === 'custom_list'
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input
          type="radio"
          name="audience-mode"
          checked={mode === 'custom_list'}
          onChange={() => setMode('custom_list')}
          className="sr-only"
        />
        <p className="text-sm font-medium text-gray-900">Custom List</p>
        <p className="mt-1 text-xs text-gray-600">
          Paste identifiers (with optional names) or upload a CSV.
        </p>
        {mode === 'custom_list' ? (
          <CustomListBody
            pasteBody={pasteBody}
            setPasteBody={setPasteBody}
            autoEnroll={autoEnroll}
            setAutoEnroll={setAutoEnroll}
          />
        ) : null}
      </label>
    </div>
  )
}

function CommonFields({
  surveyNameInMail,
  setSurveyNameInMail,
  expiryPreset,
  setExpiryPreset,
  customExpiry,
  setCustomExpiry,
  brandTimezone,
}: {
  surveyNameInMail: string
  setSurveyNameInMail: (s: string) => void
  expiryPreset: '24h' | '7d' | '30d' | '90d' | 'custom'
  setExpiryPreset: (p: '24h' | '7d' | '30d' | '90d' | 'custom') => void
  customExpiry: string
  setCustomExpiry: (s: string) => void
  brandTimezone: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block">
        <span className="block text-xs font-medium text-gray-700 mb-1">Survey name in mail</span>
        <input
          type="text"
          value={surveyNameInMail}
          maxLength={80}
          onChange={(e) => setSurveyNameInMail(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-700 mb-1">Links expire on</span>
        <select
          value={expiryPreset}
          onChange={(e) => setExpiryPreset(e.target.value as '24h' | '7d' | '30d' | '90d' | 'custom')}
          className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
          <option value="custom">Custom date+time</option>
        </select>
        {expiryPreset === 'custom' ? (
          <>
            <input
              type="datetime-local"
              value={customExpiry.replace('Z', '').slice(0, 16)}
              onChange={(e) => setCustomExpiry(new Date(e.target.value).toISOString())}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">All times in {brandTimezone}</p>
          </>
        ) : (
          <p className="mt-1 text-xs text-gray-500">End of day in {brandTimezone}</p>
        )}
      </label>
    </div>
  )
}

function LivePreview({
  preview,
  previewing,
  mode,
  brand,
}: {
  preview: PreviewResponse | null
  previewing: boolean
  mode: AudienceMode
  brand: BrandContext
}) {
  if (previewing && !preview) return <p className="text-sm text-gray-500">Loading preview…</p>
  if (!preview) return null
  // Always surface unmatched + auto-enroll counts together so the operator can
  // see why a paste of N entries produced an audience of M < N. Addresses #378
  // walk-through #15 (100 emails accepted as 75; silent truncation).
  const summaryParts: string[] = [
    `${preview.audienceCount.toLocaleString()} ${
      preview.audienceCount === 1 ? 'member' : 'members'
    } will receive this wave`,
  ]
  if (mode === 'custom_list' && preview.willAutoEnrollCount > 0) {
    summaryParts.push(`${preview.willAutoEnrollCount} will be auto-enrolled`)
  }
  if (mode === 'custom_list' && preview.unmatchedCount > 0) {
    summaryParts.push(
      `${preview.unmatchedCount} unrecognized identifier${
        preview.unmatchedCount === 1 ? '' : 's'
      } skipped`,
    )
  }
  const summary = summaryParts.join(' · ')
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900 mb-3">
        {summary}
        {previewing ? <span className="ml-2 text-xs text-gray-400">updating…</span> : null}
      </p>
      {preview.members.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-gray-600 border-b border-gray-200">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Identifier</th>
                <th className="py-2 pr-3">Last response · this survey</th>
                <th className="py-2 pr-3">Last response · all surveys</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.members.slice(0, 50).map((m, i) => (
                <tr key={`${m.memberId ?? 'new'}-${i}`}>
                  <td className="py-2 pr-3">
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || '—'}
                    {m.willAutoEnroll ? <span className="ml-1 text-amber-600">(new)</span> : null}
                  </td>
                  <td className="py-2 pr-3 font-mono">{m.identifier}</td>
                  <td className="py-2 pr-3">
                    {m.lastResponseThisSurvey
                      ? formatDistributionTzDate(m.lastResponseThisSurvey, brand.timezone, brand.locale)
                      : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {m.lastResponseAnySurvey
                      ? formatDistributionTzDate(m.lastResponseAnySurvey, brand.timezone, brand.locale)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {preview.unmatched.length > 0 ? (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <p className="text-xs font-medium text-gray-700">Unmatched ({preview.unmatched.length}):</p>
          <ul className="mt-1 text-xs text-gray-600 font-mono space-y-1">
            {preview.unmatched.slice(0, 25).map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

// ─── Success-state ────────────────────────────────────────────────────────────

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

      <div className="mt-6">
        <button type="button" onClick={onBack} className="text-sm text-indigo-600 hover:underline">
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
