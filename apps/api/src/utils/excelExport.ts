// Issue #423 — Survey Response Review v1.
//
// Server-side .xlsx renderer for the export endpoint. The cover block (rows
// 1-11) names every active filter so the workbook is self-describing when
// forwarded to stakeholders; the AI-fields disclaimer (row 13) and the
// "Powered by CustomerEQ" hyperlink row (row 14) read from single shared
// constants (`AI_FIELDS_CAVEAT`, `EXPORTS_POWERED_BY_URL`) so on-screen
// caveats and exported disclaimers never drift.

import ExcelJS from 'exceljs'
import {
  AI_FIELDS_CAVEAT,
  EXPORTS_POWERED_BY_URL,
  formatInBrandTz,
  shouldShowScoreBand,
} from '@customerEQ/shared'
import type { MemberIdentifierKind } from '@prisma/client'
import type { SurveyResponseRow } from './responseFilters.js'

interface SurveyQuestion {
  id: string
  text: string
  type?: string
}

export interface RenderInput {
  survey: { id: string; name: string; type: string; questions: SurveyQuestion[] }
  brand: { timezone: string; locale: string; memberIdentifierKind: MemberIdentifierKind }
  filters: {
    wave: 'all' | 'direct' | string
    waveLabel?: string | null   // human label resolved from DistributionBatch.label
    submittedFrom?: string | null
    submittedTo?: string | null
    scoreBands?: string[] | null
    sentimentBands?: string[] | null
    channels?: string[] | null
    scoreBandGate: { hidden: boolean }
    sentimentBandGate: { hidden: boolean }
  }
  rows: SurveyResponseRow[]
  total: number
  operatorEmail: string
}

const SCORE_BAND_LABEL: Record<string, string> = {
  promoter: 'Promoter', passive: 'Passive', detractor: 'Detractor',
  satisfied: 'Satisfied', neutral: 'Neutral', dissatisfied: 'Dissatisfied',
  easy: 'Easy', hard: 'Hard',
}
const SENT_BAND_LABEL: Record<string, string> = {
  positive: 'Positive', neutral: 'Neutral', negative: 'Negative',
}

export async function renderResponsesXlsx(input: RenderInput): Promise<Buffer> {
  const { survey, brand, filters, rows, total, operatorEmail } = input
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CustomerEQ'
  wb.created = new Date()
  const ws = wb.addWorksheet('Responses')

  // --- Cover block (rows 1-11) ---
  const exportedAt = formatInBrandTz(new Date(), brand.timezone, brand.locale, 'MMM d, yyyy h:mm a zzz')
  const cover: Array<[string, string]> = [
    ['Survey', survey.name],
    ['Survey type', survey.type],
    ['Survey ID', survey.id],
    ['Exported at', exportedAt],
    ['Exported by', operatorEmail],
    ['Wave', formatWaveValue(filters.wave, filters.waveLabel)],
    ['Submitted range', formatSubmittedRange(filters.submittedFrom, filters.submittedTo, brand.timezone)],
    ['Score band', formatBandList(filters.scoreBands, filters.scoreBandGate.hidden, SCORE_BAND_LABEL, 'All bands')],
    ['Sentiment band', formatBandList(filters.sentimentBands, filters.sentimentBandGate.hidden, SENT_BAND_LABEL, 'All sentiments')],
    ['Channels', filters.channels && filters.channels.length > 0 ? filters.channels.join(', ') : 'All channels'],
    ['Total rows', String(total)],
  ]
  cover.forEach(([key, value]) => {
    const row = ws.addRow([key, value])
    const labelCell = row.getCell(1)
    labelCell.font = { bold: true }
    labelCell.alignment = { vertical: 'top' }
  })

  // Row 12 — blank.
  ws.addRow([])

  // Row 13 — AI-fields disclaimer (italic, merged across the visible header span).
  const disclaimerRow = ws.addRow([AI_FIELDS_CAVEAT])
  disclaimerRow.getCell(1).font = { italic: true, color: { argb: 'FF92400E' } }
  disclaimerRow.getCell(1).alignment = { wrapText: true, vertical: 'top' }

  // Row 14 — Powered by CustomerEQ (hyperlinked).
  const poweredRow = ws.addRow([
    { text: 'Powered by CustomerEQ', hyperlink: EXPORTS_POWERED_BY_URL },
  ])
  poweredRow.getCell(1).font = { color: { argb: 'FF4F46E5' }, underline: true }

  // Row 15 — blank.
  ws.addRow([])

  // Row 16 — data header.
  const showScoreColumn = shouldShowScoreBand(survey.type)
  const baseColumns: string[] = ['Member', 'Channel', 'Submitted']
  if (showScoreColumn) baseColumns.push('Score')
  baseColumns.push('AI · Sentiment', 'AI · Topics', 'AI · Summary')
  const questionTexts = survey.questions.map((q) => q.text ?? q.id)
  const headerRow = ws.addRow([...baseColumns, ...questionTexts])
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }
    cell.alignment = { wrapText: true, vertical: 'top' }
  })

  // Column widths — base 20, free-text wider.
  ws.columns = [
    { width: 32 }, // Member
    { width: 14 }, // Channel
    { width: 26 }, // Submitted
    ...(showScoreColumn ? [{ width: 10 }] : []), // Score
    { width: 14 }, // AI · Sentiment
    { width: 30 }, // AI · Topics
    { width: 48 }, // AI · Summary
    ...questionTexts.map(() => ({ width: 60 })),
  ]

  // Data rows.
  for (const row of rows) {
    const memberCell = renderMemberCell(row, brand.memberIdentifierKind)
    const submittedAt = row.completedAt ?? row.importedAt ?? null
    const submitted = submittedAt
      ? formatInBrandTz(submittedAt, brand.timezone, brand.locale, 'MMM d, yyyy h:mm a zzz')
      : ''

    const cells: Array<string | number> = [memberCell, row.channel ?? '', submitted]
    if (showScoreColumn) cells.push(row.score ?? '')

    cells.push(
      sentimentLabelOf(row.sentiment),
      (row.topics ?? []).join(', '),
      row.summary ?? '',
    )

    const answers = (row.answers ?? {}) as Record<string, unknown>
    for (const q of survey.questions) {
      const value = answers[q.id]
      cells.push(value === undefined || value === null ? '' : String(value))
    }
    const dataRow = ws.addRow(cells)
    // Wrap text for free-text answer columns.
    dataRow.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' }
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function renderMemberCell(row: SurveyResponseRow, kind: MemberIdentifierKind): string {
  if (!row.member) return ''
  const { firstName, lastName, email, phone, externalId } = row.member
  const namePart = [firstName, lastName].filter(Boolean).join(' ').trim()
  const idValue =
    kind === 'EMAIL' ? (email ?? externalId)
    : kind === 'PHONE' ? (phone ?? externalId)
    : externalId
  return namePart ? `${namePart} (${idValue})` : `(${idValue})`
}

function sentimentLabelOf(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value > 0.3) return 'Positive'
  if (value < -0.3) return 'Negative'
  return 'Neutral'
}

function formatWaveValue(wave: string, label: string | null | undefined): string {
  if (wave === 'all') return 'All waves and direct responses'
  if (wave === 'direct') return 'Direct responses'
  return label ?? wave
}

function formatSubmittedRange(from: string | null | undefined, to: string | null | undefined, tz: string): string {
  if (!from && !to) return 'All time'
  const f = from ?? '—'
  const t = to ?? '—'
  return `${f} → ${t} (${tz})`
}

function formatBandList(
  bands: string[] | null | undefined,
  gateHidden: boolean,
  labels: Record<string, string>,
  noneLabel: string,
): string {
  if (gateHidden) return 'N/A'
  if (!bands || bands.length === 0) return noneLabel
  return bands.map((b) => labels[b] ?? b).join(', ')
}

/** Builds the export filename. The 60-char slug cap defends against
 * pathological survey names; tests exercise empty / all-special / long names. */
export function exportFilename(
  survey: { name: string },
  brand: { timezone: string; locale: string },
): string {
  const date = formatInBrandTz(new Date(), brand.timezone, brand.locale, 'yyyy-MM-dd')
  const safeSlug = (survey.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'survey'
  return `survey-${safeSlug}-responses-${date}.xlsx`
}
