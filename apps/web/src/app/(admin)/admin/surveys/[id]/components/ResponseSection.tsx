// Issue #423 — Survey Response Review v1.
//
// Rewrites the placeholder body that #241 Slice 4a parked here. Owns:
//   - Filter state (synced to URL via responseFilters.url codec)
//   - Pagination state (sessionStorage-backed pageSize, reset to 25 on full reload)
//   - Expand-in-row state
//   - Export-button enable/disable + tooltip
//   - AI caveat indicator surfacing the shared AI_FIELDS_CAVEAT copy
//
// Reads from `GET /v1/surveys/:id/responses`. Export trigger is an `<a href>`
// to `GET /v1/surveys/:id/responses.xlsx?token=<jwt>&…filters` so the browser
// handles the download lifecycle (auth plugin accepts `?token=` for browser-
// issued downloads — see RFC §5.2 + §13.2 #2).

'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AI_FIELDS_CAVEAT,
  EXPORT_ROW_CAP,
  formatInBrandTz,
  NPS, CSAT, CES,
  defaultScaleForType,
  shouldShowScoreBand,
  type ResponseFilters,
} from '@customerEQ/shared'

import { API_URL, getAuthToken } from '@/lib/config'
import { FilterChipGroup } from '@/components/filters/FilterChipGroup'
import { SubmittedDateRange, resolvePresetRange, type SubmittedDateRangeValue, type SubmittedPreset } from '@/components/filters/SubmittedDateRange'
import { FilterBar } from '@/components/filters/FilterBar'
import { bandChipsForType } from '@/components/filters/filter-chips.logic'
import { encodeFiltersToQs } from '@/components/filters/responseFilters.url'
import { CollapsibleSection } from './CollapsibleSection'
import { AiCaveatIndicator } from './AiCaveatIndicator'
import { ResponsePagination } from './ResponsePagination'
import {
  SurveyResponsesHeaderStrip,
  type SurveyResponsesHeaderStripProps,
} from './SurveyResponsesHeaderStrip'
import type { Wave } from './waveTypes'

const PAGE_SIZE_STORAGE_KEY_PREFIX = 'response-section.pageSize.'

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM' | string

interface ResponseRow {
  id: string
  answers: Record<string, unknown>
  score: number | null
  sentiment: number | null
  confidence: number | null
  topics: string[]
  summary: string | null
  channel: string
  completedAt: string | null
  importedAt: string | null
  distributionBatchId: string | null
  distributionBatchLabel: string | null
  importBatchId: string | null
  importBatchName: string | null
  member: { firstName: string | null; lastName: string | null; identifierValue: string } | null
}

interface ListEnvelope {
  data: ResponseRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  filters: {
    scoreBandGate: { hidden: boolean }
    sentimentBandGate: { hidden: boolean }
  }
}

interface SurveyQuestion {
  id: string
  text: string
  type?: string
}

export interface ResponseSectionProps {
  surveyId: string
  surveyType: SurveyType
  surveyName: string
  brandTimezone: string
  brandLocale: string
  responsesCount: number
  questions: SurveyQuestion[]
  /** Wave selection lifted from the parent. */
  wave: Wave
  /** Issue #420 R40 — surfaced inputs for the new <SurveyResponsesHeaderStrip>.
   *  When omitted, the strip is suppressed (older callers/tests stay valid). */
  surveyLifetimeSentCount?: number
  batches?: SurveyResponsesHeaderStripProps['batches']
  hasDirectResponses?: boolean
  onWaveChange?: (next: Wave) => void
}

export function ResponseSection({
  surveyId,
  surveyType,
  surveyName,
  brandTimezone,
  brandLocale,
  responsesCount,
  questions,
  wave,
  surveyLifetimeSentCount,
  batches,
  hasDirectResponses,
  onWaveChange,
}: ResponseSectionProps) {
  const { getToken } = useAuth()
  // Stash getToken in a ref so fetchPage / download-token effects don't fire
  // every render (Clerk's hook returns a fresh reference per render in some
  // configurations and would otherwise loop the data-load effect).
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])

  const [submitted, setSubmitted] = useState<SubmittedDateRangeValue>({ preset: 'all', from: null, to: null })
  const [scoreBands, setScoreBands] = useState<string[]>([])
  const [sentimentBands, setSentimentBands] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(() => {
    if (typeof window === 'undefined') return 25
    const stored = window.sessionStorage.getItem(`${PAGE_SIZE_STORAGE_KEY_PREFIX}${surveyId}`)
    const parsed = stored ? Number(stored) : 25
    return parsed === 50 || parsed === 100 ? parsed : 25
  })
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [envelope, setEnvelope] = useState<ListEnvelope | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Export download token is fetched JIT in the click handler (see
  // `handleExportClick`) so it never goes stale before use; kept as state
  // only to satisfy the existing reference shape.
  const [downloadToken, setDownloadToken] = useState<string | null>(null)

  // Wave coercion for the request shape.
  const waveQuery: ResponseFilters['wave'] =
    wave === 'all' ? 'all'
    : wave === 'direct' ? 'direct'
    : wave.batchId

  // Reset to page 1 whenever filters or wave change (otherwise we can land
  // on an out-of-range page).
  useEffect(() => {
    setPage(1)
  }, [waveQuery, submitted.from, submitted.to, submitted.preset, scoreBands.join(','), sentimentBands.join(','), channels.join(',')])

  // Persist page size for the page session; reload resets to 25 (R11).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(`${PAGE_SIZE_STORAGE_KEY_PREFIX}${surveyId}`, String(pageSize))
  }, [surveyId, pageSize])

  // Clerk JWTs are short-lived (≤60s). Pre-fetching the token at mount and
  // baking it into the `<a href>` produces a stale URL — by the time the
  // operator clicks Export, the token has often expired. Instead we leave
  // `downloadToken` null on the initial render and fetch a fresh token in
  // the click handler (see `handleExportClick`); the anchor is built lazily.
  // We still track `downloadToken` so the UI can show a transient "fetching
  // credentials" state, but it is not what the anchor consumes.
  void setDownloadToken
  void downloadToken

  const fetchPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAuthToken(getTokenRef.current)
      if (!token) throw new Error('Sign in to load responses')
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('pageSize', String(pageSize))
      if (waveQuery !== 'all') qs.set('wave', String(waveQuery))
      if (submitted.from) qs.set('submittedFrom', submitted.from)
      if (submitted.to) qs.set('submittedTo', submitted.to)
      if (scoreBands.length > 0) qs.set('scoreBands', scoreBands.join(','))
      if (sentimentBands.length > 0) qs.set('sentimentBands', sentimentBands.join(','))
      if (channels.length > 0) qs.set('channels', channels.join(','))
      const res = await fetch(`${API_URL}/v1/surveys/${surveyId}/responses?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to load responses (${res.status})`)
      const body = (await res.json()) as ListEnvelope
      setEnvelope(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load responses')
      setEnvelope(null)
    } finally {
      setLoading(false)
    }
  }, [surveyId, page, pageSize, waveQuery, submitted.from, submitted.to, scoreBands, sentimentBands, channels])

  useEffect(() => {
    // Skip the list fetch when the survey has zero responses — the JSX
    // short-circuits to the non-table empty state. (Also prevents the
    // setEnvelope re-render loop that would result from fetching against
    // an obviously-empty survey on every render.)
    if (responsesCount === 0) return
    void fetchPage()
  }, [fetchPage, responsesCount])

  // Derived filter state for shared filter primitives.
  const hasOpenEndedQ = useMemo(
    () => questions.some((q) => q.type === 'text' || q.type === 'open_text' || q.type === 'long_text' || q.type === 'textarea'),
    [questions],
  )
  const scoreBandGateHidden = envelope?.filters?.scoreBandGate?.hidden ?? !shouldShowScoreBand(surveyType)
  const sentimentBandGateHidden = envelope?.filters?.sentimentBandGate?.hidden ?? (!shouldShowScoreBand(surveyType) || !hasOpenEndedQ)

  const scoreBandOptions = useMemo(() => bandChipsForType(surveyType), [surveyType])
  const sentimentBandOptions = useMemo(
    () => [
      { value: 'positive', label: 'Positive' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'negative', label: 'Negative' },
    ],
    [],
  )
  const channelOptions = useMemo(() => deriveChannelOptions(envelope?.data ?? []), [envelope?.data])

  // Export state. The anchor's `href` is built at click time so the token is
  // fresh; this avoids the Clerk-60s-expiry trap where a pre-mounted token is
  // already stale by the time the operator clicks Export.
  const total = envelope?.total ?? 0
  const exportDisabled = total === 0 || total > EXPORT_ROW_CAP
  const exportTooltip =
    total === 0
      ? 'Nothing to export — current filters yield 0 responses.'
      : total > EXPORT_ROW_CAP
        ? `Filtered set is ${total.toLocaleString()} responses — narrow the filters (try a date range or a single wave) and try again.`
        : 'Exports rows matching current filters.'

  const exportFilename = `survey-${slug(surveyName)}-responses.xlsx`

  const handleExportClick = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (exportDisabled) return
    const token = await getAuthToken(getTokenRef.current)
    if (!token) {
      setError('Sign in to export.')
      return
    }
    const state: ResponseFilters = {
      wave: waveQuery,
      submittedFrom: submitted.from ?? undefined,
      submittedTo: submitted.to ?? undefined,
      scoreBands: scoreBands.length > 0 ? (scoreBands as ResponseFilters['scoreBands']) : undefined,
      sentimentBands: sentimentBands.length > 0 ? (sentimentBands as ResponseFilters['sentimentBands']) : undefined,
      channels: channels.length > 0 ? channels : undefined,
    }
    const filterQs = encodeFiltersToQs(state)
    const base = `${API_URL}/v1/surveys/${surveyId}/responses.xlsx`
    const url = filterQs
      ? `${base}?${filterQs}&token=${encodeURIComponent(token)}`
      : `${base}?token=${encodeURIComponent(token)}`
    // Trigger the download by navigating a hidden anchor; the browser keeps
    // the page open because of `download` + `Content-Disposition: attachment`.
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [exportDisabled, surveyId, waveQuery, submitted.from, submitted.to, scoreBands, sentimentBands, channels, exportFilename])

  // ---- Render ----

  const responseLabel = useMemo(() => {
    const t = total.toLocaleString()
    return `${t} response${total === 1 ? '' : 's'}`
  }, [total])

  return (
    <CollapsibleSection
      title={
        <span className="flex items-center gap-2">
          <span>Response</span>
          <span
            data-testid="response-count-badge"
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
          >
            {responseLabel}
          </span>
        </span>
      }
      expandedDefault={responsesCount > 0}
      rightSlot={
        <a
          data-testid="response-export-button"
          href="#"
          onClick={handleExportClick}
          aria-disabled={exportDisabled}
          title={exportTooltip}
          className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 ${
            exportDisabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          Export to Excel
        </a>
      }
    >
      {/* Issue #420 R40 / V9 — Sent + Responses + Wave-filter strip.
          Renders when the parent supplied the wave-control inputs AND the
          survey has at least one batch or direct response (otherwise the
          strip would surface nothing actionable). Stays above the empty-state
          so an operator with sent>0 / responses=0 sees "0 of N" rather than
          a bare empty-state. */}
      {onWaveChange !== undefined &&
      batches !== undefined &&
      surveyLifetimeSentCount !== undefined &&
      (batches.length > 0 || hasDirectResponses) ? (
        <SurveyResponsesHeaderStrip
          surveyId={surveyId}
          surveyLifetimeSentCount={surveyLifetimeSentCount}
          batches={batches}
          hasDirectResponses={hasDirectResponses ?? false}
          selectedWave={wave}
          onWaveChange={onWaveChange}
          filteredResponseCount={envelope?.total ?? responsesCount}
          brandTimezone={brandTimezone}
          brandLocale={brandLocale}
        />
      ) : null}

      {responsesCount === 0 ? (
        <div className="px-2 py-10 text-center text-sm text-slate-500" data-testid="response-empty-zero">
          <p className="text-base font-semibold text-slate-700">No responses yet</p>
          <p className="mt-1">Distribute the survey or run a historical import to populate this view.</p>
        </div>
      ) : (
        <>
          <FilterBar
            inlineGroups={[
              <FilterChipGroup
                key="score"
                groupKey="score-band"
                label="Score band"
                options={scoreBandOptions}
                selected={scoreBands}
                onChange={setScoreBands}
                hidden={scoreBandGateHidden}
              />,
              <FilterChipGroup
                key="sentiment"
                groupKey="sentiment-band"
                label="Sentiment band"
                options={sentimentBandOptions}
                selected={sentimentBands}
                onChange={setSentimentBands}
                hidden={sentimentBandGateHidden}
                helperIcon={<AiCaveatIndicator text="AI-derived. Computed across all open-ended answers per response. Correct for single-text-question surveys. Later phases will refine these AI-derived values." />}
              />,
              <SubmittedDateRange
                key="submitted"
                value={submitted}
                brandTimezone={brandTimezone}
                onChange={(next) => {
                  // Resolve preset ranges client-side (server still re-validates).
                  if (next.preset !== 'custom' && next.preset !== submitted.preset) {
                    const range = resolvePresetRange(next.preset as SubmittedPreset)
                    setSubmitted({ preset: next.preset, ...range })
                    return
                  }
                  setSubmitted(next)
                }}
              />,
            ]}
            overflowGroup={
              <FilterChipGroup
                groupKey="channel"
                label="Channel"
                options={channelOptions}
                selected={channels}
                onChange={setChannels}
              />
            }
          />

          {loading ? (
            <div className="px-2 py-6 text-sm text-slate-500">Loading…</div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
              <button onClick={fetchPage} className="ml-2 underline">Retry</button>
            </div>
          ) : envelope && envelope.total === 0 ? (
            <div className="px-2 py-10 text-center text-sm text-slate-500" data-testid="response-empty-filtered">
              <p className="text-base font-semibold text-slate-700">No responses match the current filters</p>
              <p className="mt-1">Try widening the date range or selecting more channels.</p>
              <button
                onClick={() => {
                  setScoreBands([])
                  setSentimentBands([])
                  setChannels([])
                  setSubmitted({ preset: 'all', from: null, to: null })
                }}
                className="mt-3 text-xs text-indigo-600 hover:underline"
                data-testid="clear-filters-link"
              >
                Clear filters
              </button>
            </div>
          ) : envelope ? (
            <>
              <ResponseTable
                rows={envelope.data}
                surveyType={surveyType}
                showScoreColumn={shouldShowScoreBand(surveyType)}
                questions={questions}
                brandTimezone={brandTimezone}
                brandLocale={brandLocale}
                expandedRowId={expandedRowId}
                onToggleExpand={(rowId) => setExpandedRowId((prev) => (prev === rowId ? null : rowId))}
              />
              <ResponsePagination
                page={envelope.page}
                pageSize={pageSize}
                total={envelope.total}
                totalPages={envelope.totalPages}
                onPageChange={setPage}
                onPageSizeChange={(next) => setPageSize(next)}
              />
            </>
          ) : null}
        </>
      )}
    </CollapsibleSection>
  )
}

// ---------------------------------------------------------------------------

interface ResponseTableProps {
  rows: ResponseRow[]
  surveyType: SurveyType
  showScoreColumn: boolean
  questions: SurveyQuestion[]
  brandTimezone: string
  brandLocale: string
  expandedRowId: string | null
  onToggleExpand: (rowId: string) => void
}

function ResponseTable({ rows, surveyType, showScoreColumn, questions, brandTimezone, brandLocale, expandedRowId, onToggleExpand }: ResponseTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200" data-testid="response-table-wrap">
      <table className="min-w-full text-sm" data-testid="response-table">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Member</th>
            <th className="px-3 py-2 text-left font-semibold">Channel</th>
            <th className="px-3 py-2 text-left font-semibold">Submitted</th>
            {showScoreColumn ? <th className="px-3 py-2 text-left font-semibold">Score</th> : null}
            <th className="px-3 py-2 text-left font-semibold bg-violet-50">AI · Sentiment</th>
            <th className="px-3 py-2 text-left font-semibold bg-violet-50">AI · Topics</th>
            <th className="px-3 py-2 text-left font-semibold bg-violet-50">
              <span className="inline-flex items-center gap-1">
                AI · Summary
                <AiCaveatIndicator />
              </span>
            </th>
            {questions.map((q) => (
              <th key={q.id} className="px-3 py-2 text-left font-semibold" title={q.text} aria-describedby={`q-aria-${q.id}`}>
                <span className="inline-block max-w-[180px] truncate" data-testid={`response-th-${q.id}`}>
                  {q.text}
                </span>
                <span id={`q-aria-${q.id}`} className="sr-only">{q.text}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ResponseRowView
              key={row.id}
              row={row}
              surveyType={surveyType}
              showScoreColumn={showScoreColumn}
              questions={questions}
              brandTimezone={brandTimezone}
              brandLocale={brandLocale}
              expanded={expandedRowId === row.id}
              onToggleExpand={() => onToggleExpand(row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ResponseRowViewProps {
  row: ResponseRow
  surveyType: SurveyType
  showScoreColumn: boolean
  questions: SurveyQuestion[]
  brandTimezone: string
  brandLocale: string
  expanded: boolean
  onToggleExpand: () => void
}

function ResponseRowView({ row, surveyType, showScoreColumn, questions, brandTimezone, brandLocale, expanded, onToggleExpand }: ResponseRowViewProps) {
  const memberCell =
    !row.member
      ? <span className="text-slate-400">—</span>
      : (
          <span>
            {(row.member.firstName || row.member.lastName) && (
              <span className="font-medium">{[row.member.firstName, row.member.lastName].filter(Boolean).join(' ')} </span>
            )}
            <span className="font-mono text-xs text-slate-500">({row.member.identifierValue})</span>
          </span>
        )

  const submittedAt = row.completedAt ?? row.importedAt
  const submitted = submittedAt
    ? formatInBrandTz(submittedAt, brandTimezone, brandLocale, 'MMM d, yyyy h:mm a zzz')
    : '—'

  const band = row.score !== null && showScoreColumn ? bandOf(surveyType, row.score) : null
  const scoreTint = band === 'promoter' || band === 'satisfied' || band === 'easy'
    ? 'bg-emerald-50 text-emerald-700'
    : band === 'passive' || band === 'neutral'
      ? 'bg-amber-50 text-amber-700'
      : band === 'detractor' || band === 'dissatisfied' || band === 'hard'
        ? 'bg-rose-50 text-rose-700'
        : ''

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50 ${expanded ? 'bg-indigo-50/40' : ''}`} data-testid={`response-row-${row.id}`}>
        <td className="px-3 py-2 align-top">{memberCell}</td>
        <td className="px-3 py-2 align-top font-mono text-xs text-slate-500">{row.channel}</td>
        <td className="px-3 py-2 align-top text-xs whitespace-nowrap">{submitted}</td>
        {showScoreColumn ? (
          <td className={`px-3 py-2 align-top font-semibold ${scoreTint}`}>
            {row.score !== null ? <span>{row.score}<span className="ml-1 text-[11px] font-normal text-slate-500">/ {maxForType(surveyType)}</span></span> : '—'}
          </td>
        ) : null}
        <td className="px-3 py-2 align-top">
          {row.sentiment !== null ? <SentimentChip value={row.sentiment} /> : null}
        </td>
        <td className="px-3 py-2 align-top">
          {(row.topics ?? []).slice(0, 3).map((t) => (
            <span key={t} className="mr-1 inline-block rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">{t}</span>
          ))}
          {row.topics && row.topics.length > 3 ? (
            <span className="rounded-full bg-white px-1.5 text-[11px] text-slate-500" title={row.topics.slice(3).join(', ')}>+{row.topics.length - 3}</span>
          ) : null}
        </td>
        <td className="px-3 py-2 align-top text-xs italic text-slate-600">
          <TruncatedCell text={row.summary ?? ''} max={120} />
        </td>
        {questions.map((q) => {
          const v = row.answers?.[q.id]
          const isLongText = typeof v === 'string' && v.length > 120
          return (
            <td key={q.id} className="px-3 py-2 align-top text-xs">
              {v === undefined || v === null || v === ''
                ? <span className="text-slate-300">—</span>
                : isLongText
                  ? (
                      <span>
                        {String(v).slice(0, 120)}…
                        <button
                          type="button"
                          onClick={onToggleExpand}
                          className="ml-1 text-[11px] font-medium text-indigo-600 hover:underline"
                          data-testid={`expand-cell-${row.id}-${q.id}`}
                        >
                          {expanded ? 'less' : 'more'}
                        </button>
                      </span>
                    )
                  : <span>{String(v)}</span>}
            </td>
          )
        })}
      </tr>
      {expanded ? (
        <tr className="bg-indigo-50/30" data-testid={`response-row-expanded-${row.id}`}>
          <td colSpan={3 + (showScoreColumn ? 1 : 0) + 3 + questions.length} className="px-4 py-3 text-sm text-slate-700">
            <div className="space-y-3">
              {questions.map((q) => {
                const v = row.answers?.[q.id]
                if (v === undefined || v === null || v === '') return null
                return (
                  <div key={q.id}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{q.text}</div>
                    <div className="mt-1 whitespace-pre-wrap">{String(v)}</div>
                  </div>
                )
              })}
              {row.summary ? (
                <div className="rounded-md border border-indigo-100 bg-white p-2 text-xs">
                  <strong className="text-indigo-700">AI · Summary:</strong> {row.summary}
                </div>
              ) : null}
              <button
                onClick={onToggleExpand}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                less
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function SentimentChip({ value }: { value: number }) {
  const label = value > 0.3 ? 'Positive' : value < -0.3 ? 'Negative' : 'Neutral'
  const cls =
    label === 'Positive' ? 'bg-emerald-100 text-emerald-700'
    : label === 'Negative' ? 'bg-rose-100 text-rose-700'
    : 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}
      title={`${value >= 0 ? '+' : ''}${value.toFixed(2)}`}
      data-testid="sentiment-chip"
    >
      {label}
    </span>
  )
}

function TruncatedCell({ text, max }: { text: string; max: number }) {
  if (text.length <= max) return <span>{text}</span>
  return (
    <span title={text}>
      {text.slice(0, max)}…
    </span>
  )
}

function bandOf(type: SurveyType, score: number): string | null {
  if (type !== 'NPS' && type !== 'CSAT' && type !== 'CES') return null
  const scale = defaultScaleForType(type)
  const table =
    type === 'NPS' ? NPS.bandsForScale(scale)
    : type === 'CSAT' ? CSAT.bandsForScale(scale)
    : CES.bandsForScale(scale)
  return table.bandOf(score)
}

function maxForType(type: SurveyType): number {
  if (type === 'NPS') return 10
  if (type === 'CSAT') return 5
  if (type === 'CES') return 7
  return 0
}

function deriveChannelOptions(rows: ResponseRow[]) {
  const set = new Set<string>()
  rows.forEach((r) => set.add(r.channel))
  // Always include the canonical defaults so the chip group is stable as
  // pages of data change. Sorted for deterministic rendering.
  ;['email', 'in_app', 'link', 'sms', 'review'].forEach((c) => set.add(c))
  return Array.from(set).sort().map((value) => ({ value, label: value }))
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'survey'
}

// Expose the constant so callers / tests can inspect.
export const _AI_FIELDS_CAVEAT = AI_FIELDS_CAVEAT
