import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { renderResponsesXlsx, exportFilename } from './excelExport.js'
import type { SurveyResponseRow } from './responseFilters.js'
import { AI_FIELDS_CAVEAT, EXPORTS_POWERED_BY_URL } from '@customerEQ/shared'

const brand = { timezone: 'America/Los_Angeles', locale: 'en-US', memberIdentifierKind: 'EMAIL' as const }
const surveyNps = {
  id: 'srv_abc',
  name: 'Q2 2026 Customer Pulse',
  type: 'NPS',
  questions: [
    { id: 'q1', text: 'How likely are you to recommend Acme to a friend or colleague? (0 = not at all, 10 = extremely)', type: 'rating' },
    { id: 'q2', text: "What's the main reason for the score you gave?", type: 'text' },
  ],
}

function rowFactory(overrides: Partial<SurveyResponseRow> = {}): SurveyResponseRow {
  return {
    id: 'r1', surveyId: 'srv_abc', brandId: 'br1', memberId: 'm1',
    answers: { q1: 9, q2: 'Their support team was great.' },
    score: 9, sentiment: 0.5, confidence: 0.9, topics: ['support'], summary: 'Happy.',
    channel: 'email',
    completedAt: new Date('2026-05-18T18:24:00Z'),
    importedAt: null,
    distributionBatchId: null, importBatchId: null,
    member: { id: 'm1', firstName: 'Jane', lastName: 'Cooper', email: 'jane@cooper.com', phone: null, externalId: 'cust_1' },
    distributionBatch: null, importBatch: null,
    ...overrides,
  } as SurveyResponseRow
}

describe('renderResponsesXlsx — cover block', () => {
  it('writes the 11-row cover block + disclaimer + Powered-by + data header', async () => {
    const buffer = await renderResponsesXlsx({
      survey: surveyNps,
      brand,
      filters: {
        wave: 'all', submittedFrom: null, submittedTo: null,
        scoreBands: [], sentimentBands: [], channels: [],
        scoreBandGate: { hidden: false }, sentimentBandGate: { hidden: false },
      },
      rows: [rowFactory()],
      total: 1,
      operatorEmail: 'manohar@example.com',
    })

    const wb = new ExcelJS.Workbook()
    // ExcelJS's `load` accepts Buffer / Uint8Array / ArrayBuffer; the Node 22
    // @types make `Buffer` generic which doesn't match the older non-generic
    // type in exceljs's declarations. Casting through `unknown` is the
    // canonical workaround until exceljs publishes updated types.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.getWorksheet('Responses')!

    expect(ws.getRow(1).getCell(1).value).toBe('Survey')
    expect(ws.getRow(1).getCell(2).value).toBe('Q2 2026 Customer Pulse')
    expect(ws.getRow(2).getCell(1).value).toBe('Survey type')
    expect(ws.getRow(2).getCell(2).value).toBe('NPS')
    expect(ws.getRow(3).getCell(1).value).toBe('Survey ID')
    expect(ws.getRow(3).getCell(2).value).toBe('srv_abc')
    expect(ws.getRow(5).getCell(1).value).toBe('Exported by')
    expect(ws.getRow(5).getCell(2).value).toBe('manohar@example.com')
    expect(ws.getRow(8).getCell(2).value).toBe('All bands')
    expect(ws.getRow(9).getCell(2).value).toBe('All sentiments')
    expect(ws.getRow(10).getCell(2).value).toBe('All channels')
    expect(ws.getRow(11).getCell(2).value).toBe('1')

    // Row 12 blank.
    expect(ws.getRow(12).getCell(1).value).toBeNull()

    // Row 13 disclaimer — must contain the AI_FIELDS_CAVEAT constant verbatim.
    expect(ws.getRow(13).getCell(1).value).toContain('AI-derived columns')
    expect(ws.getRow(13).getCell(1).value).toBe(AI_FIELDS_CAVEAT)

    // Row 14 Powered-by with hyperlink to the shared constant.
    const poweredCell = ws.getRow(14).getCell(1)
    const cellValue = poweredCell.value as { text?: string; hyperlink?: string }
    expect(cellValue.text).toContain('Powered by CustomerEQ')
    expect(cellValue.hyperlink).toBe(EXPORTS_POWERED_BY_URL)

    // Row 16 — data header.
    const headerRow = ws.getRow(16)
    expect(headerRow.getCell(1).value).toBe('Member')
    expect(headerRow.getCell(2).value).toBe('Channel')
    expect(headerRow.getCell(3).value).toBe('Submitted')
    expect(headerRow.getCell(4).value).toBe('Score')
    expect(headerRow.getCell(5).value).toBe('AI · Sentiment')
    expect(headerRow.getCell(6).value).toBe('AI · Topics')
    expect(headerRow.getCell(7).value).toBe('AI · Summary')
    // Per-question column headers carry the FULL question text (no truncation,
    // no AI prefix — these are the customer's actual questions).
    expect(headerRow.getCell(8).value).toContain('How likely are you to recommend Acme')
    expect(headerRow.getCell(9).value).toContain("What's the main reason for the score you gave?")

    // Data row 17.
    const dataRow = ws.getRow(17)
    expect(dataRow.getCell(1).value).toBe('Jane Cooper (jane@cooper.com)')
    expect(dataRow.getCell(2).value).toBe('email')
    expect(dataRow.getCell(4).value).toBe(9)
    expect(dataRow.getCell(5).value).toBe('Positive')
    expect(dataRow.getCell(6).value).toBe('support')
    expect(dataRow.getCell(7).value).toBe('Happy.')
    expect(dataRow.getCell(8).value).toBe('9') // verbatim answer for q1
    expect(dataRow.getCell(9).value).toContain('Their support team was great.')
  })

  it('hides the Score column for CUSTOM-type surveys and marks Score band: N/A', async () => {
    const surveyCustom = { id: 'srv_c', name: 'Onboarding feedback', type: 'CUSTOM', questions: [{ id: 'q1', text: 'What helped?', type: 'text' }] }
    const buffer = await renderResponsesXlsx({
      survey: surveyCustom,
      brand,
      filters: {
        wave: 'all', submittedFrom: null, submittedTo: null,
        scoreBands: [], sentimentBands: [], channels: [],
        scoreBandGate: { hidden: true }, sentimentBandGate: { hidden: true },
      },
      rows: [rowFactory({ score: null, answers: { q1: 'The walkthrough.' } })],
      total: 1,
      operatorEmail: 'admin@example.com',
    })
    const wb = new ExcelJS.Workbook()
    // ExcelJS's `load` accepts Buffer / Uint8Array / ArrayBuffer; the Node 22
    // @types make `Buffer` generic which doesn't match the older non-generic
    // type in exceljs's declarations. Casting through `unknown` is the
    // canonical workaround until exceljs publishes updated types.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.getWorksheet('Responses')!
    expect(ws.getRow(8).getCell(2).value).toBe('N/A')
    expect(ws.getRow(9).getCell(2).value).toBe('N/A')

    const headerRow = ws.getRow(16)
    expect(headerRow.getCell(1).value).toBe('Member')
    expect(headerRow.getCell(2).value).toBe('Channel')
    expect(headerRow.getCell(3).value).toBe('Submitted')
    // No Score column for CUSTOM type.
    expect(headerRow.getCell(4).value).toBe('AI · Sentiment')
  })

  it('renders the Wave value when a specific batch label is provided', async () => {
    const buffer = await renderResponsesXlsx({
      survey: surveyNps,
      brand,
      filters: {
        wave: 'cabcdefghij1234567890klmn', waveLabel: 'Q2 Gold-tier wave · Apr 15',
        submittedFrom: '2026-04-15', submittedTo: '2026-04-22',
        scoreBands: ['detractor'], sentimentBands: ['negative'], channels: ['email', 'sms'],
        scoreBandGate: { hidden: false }, sentimentBandGate: { hidden: false },
      },
      rows: [],
      total: 0,
      operatorEmail: 'admin@example.com',
    })
    const wb = new ExcelJS.Workbook()
    // ExcelJS's `load` accepts Buffer / Uint8Array / ArrayBuffer; the Node 22
    // @types make `Buffer` generic which doesn't match the older non-generic
    // type in exceljs's declarations. Casting through `unknown` is the
    // canonical workaround until exceljs publishes updated types.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.getWorksheet('Responses')!
    expect(ws.getRow(6).getCell(2).value).toBe('Q2 Gold-tier wave · Apr 15')
    expect(ws.getRow(7).getCell(2).value).toContain('2026-04-15')
    expect(ws.getRow(7).getCell(2).value).toContain('2026-04-22')
    expect(ws.getRow(8).getCell(2).value).toBe('Detractor')
    expect(ws.getRow(9).getCell(2).value).toBe('Negative')
    expect(ws.getRow(10).getCell(2).value).toBe('email, sms')
  })

  it('renders empty Member cell for anonymous rows', async () => {
    const buffer = await renderResponsesXlsx({
      survey: surveyNps,
      brand,
      filters: {
        wave: 'all', scoreBands: [], sentimentBands: [], channels: [],
        scoreBandGate: { hidden: false }, sentimentBandGate: { hidden: false },
      },
      rows: [rowFactory({ memberId: null, member: null })],
      total: 1,
      operatorEmail: 'admin@example.com',
    })
    const wb = new ExcelJS.Workbook()
    // ExcelJS's `load` accepts Buffer / Uint8Array / ArrayBuffer; the Node 22
    // @types make `Buffer` generic which doesn't match the older non-generic
    // type in exceljs's declarations. Casting through `unknown` is the
    // canonical workaround until exceljs publishes updated types.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.getWorksheet('Responses')!
    expect(ws.getRow(17).getCell(1).value).toBe('')
  })
})

describe('exportFilename', () => {
  it('slugifies a normal survey name', () => {
    const f = exportFilename({ name: 'Q2 2026 Customer Pulse' }, brand)
    expect(f).toMatch(/^survey-q2-2026-customer-pulse-responses-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
  it('replaces special characters with single hyphens', () => {
    const f = exportFilename({ name: 'NPS // Q3?!' }, brand)
    expect(f).toMatch(/^survey-nps-q3-responses-/)
  })
  it('caps the slug at 60 characters', () => {
    const longName = 'a'.repeat(200)
    const f = exportFilename({ name: longName }, brand)
    const slugPart = f.replace(/^survey-/, '').replace(/-responses-.+$/, '')
    expect(slugPart.length).toBe(60)
  })
  it('falls back to "survey" for empty / all-special-char names', () => {
    expect(exportFilename({ name: '' }, brand)).toMatch(/^survey-survey-responses-/)
    expect(exportFilename({ name: '!!!' }, brand)).toMatch(/^survey-survey-responses-/)
  })
})
