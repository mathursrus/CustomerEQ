import { describe, it, expect } from 'vitest'
import {
  buildResponseWhere,
  buildFiltersEcho,
  hasOpenEndedQuestion,
  projectResponseRow,
  type SurveyResponseRow,
} from './responseFilters.js'

const brandTz = 'America/Los_Angeles'

describe('buildResponseWhere — wave selection', () => {
  it("wave='all' adds no batch filter", () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all' },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    expect(where.distributionBatchId).toBeUndefined()
    expect(where.AND).toBeUndefined()
  })
  it("wave='direct' requires both batch and import IDs null", () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'direct' },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const and = where.AND as Array<{ distributionBatchId: null; importBatchId: null }>
    expect(and[0]).toEqual({ distributionBatchId: null, importBatchId: null })
  })
  it("specific batchId pins distributionBatchId", () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'cabcdefghij1234567890klmn' },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    expect(where.distributionBatchId).toBe('cabcdefghij1234567890klmn')
  })
})

describe('buildResponseWhere — score bands (type-gated)', () => {
  it('NPS detractor → score 0..6 range', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', scoreBands: ['detractor'] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ score?: { gte: number; lte: number } }> }>)[0]?.OR
    expect(orGroup).toEqual([{ score: { gte: 0, lte: 6 } }])
  })
  it('CSAT dissatisfied → score 1..2 range', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', scoreBands: ['dissatisfied'] },
      survey: { type: 'CSAT' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ score?: { gte: number; lte: number } }> }>)[0]?.OR
    expect(orGroup).toEqual([{ score: { gte: 1, lte: 2 } }])
  })
  it('CES easy → score 5..7 range', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', scoreBands: ['easy'] },
      survey: { type: 'CES' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ score?: { gte: number; lte: number } }> }>)[0]?.OR
    expect(orGroup).toEqual([{ score: { gte: 5, lte: 7 } }])
  })
  it('CUSTOM survey silently ignores scoreBands (no AND group)', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', scoreBands: ['promoter'] },
      survey: { type: 'CUSTOM' }, brand: { timezone: brandTz },
    })
    expect(where.AND).toBeUndefined()
  })
})

describe('buildResponseWhere — sentiment bands', () => {
  it('positive uses strict `gt` against +0.3', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', sentimentBands: ['positive'] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ sentiment?: unknown }> }>)[0]?.OR
    expect(orGroup).toEqual([{ sentiment: { gt: 0.3 } }])
  })
  it('negative uses strict `lt` against -0.3', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', sentimentBands: ['negative'] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ sentiment?: unknown }> }>)[0]?.OR
    expect(orGroup).toEqual([{ sentiment: { lt: -0.3 } }])
  })
  it('neutral is the closed interval [-0.3, +0.3]', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', sentimentBands: ['neutral'] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ sentiment?: unknown }> }>)[0]?.OR
    expect(orGroup).toEqual([{ sentiment: { gte: -0.3, lte: 0.3 } }])
  })
})

describe('buildResponseWhere — channel multi-select', () => {
  it('passes channels[] as `{ in: [...] }`', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', channels: ['email', 'sms'] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    expect(where.channel).toEqual({ in: ['email', 'sms'] })
  })
  it('empty channels[] is a no-op (no filter)', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', channels: [] },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    expect(where.channel).toBeUndefined()
  })
})

describe('buildResponseWhere — submitted range (brand-TZ EOD)', () => {
  it('builds an OR splitting live (importedAt null) vs import rows', () => {
    const where = buildResponseWhere({
      surveyId: 'srv1', brandId: 'br1',
      filters: { wave: 'all', submittedFrom: '2026-04-15', submittedTo: '2026-04-22' },
      survey: { type: 'NPS' }, brand: { timezone: brandTz },
    })
    const orGroup = (where.AND as Array<{ OR?: Array<{ completedAt?: unknown; importedAt?: unknown }> }>)[0]?.OR
    expect(orGroup).toHaveLength(2)
    // Live branch: importedAt IS NULL AND completedAt in range.
    expect(orGroup?.[0]).toMatchObject({ importedAt: null })
    expect(orGroup?.[0]).toHaveProperty('completedAt')
    // Import branch: importedAt in range.
    expect(orGroup?.[1]).toHaveProperty('importedAt')
  })
})

describe('buildFiltersEcho', () => {
  it('hides score-band gate for non-CX types', () => {
    const echo = buildFiltersEcho({ wave: 'all' }, { type: 'CUSTOM' }, true)
    expect(echo.scoreBandGate.hidden).toBe(true)
    expect(echo.sentimentBandGate.hidden).toBe(true)
  })
  it('hides sentiment-band gate when survey has no open-ended questions', () => {
    const echo = buildFiltersEcho({ wave: 'all' }, { type: 'NPS' }, false)
    expect(echo.scoreBandGate.hidden).toBe(false)
    expect(echo.sentimentBandGate.hidden).toBe(true)
  })
  it('shows both gates for NPS with open-ended question', () => {
    const echo = buildFiltersEcho({ wave: 'all' }, { type: 'NPS' }, true)
    expect(echo.scoreBandGate.hidden).toBe(false)
    expect(echo.sentimentBandGate.hidden).toBe(false)
  })
})

describe('hasOpenEndedQuestion', () => {
  it('detects text-type questions', () => {
    expect(hasOpenEndedQuestion([{ id: 'q1', type: 'rating' }, { id: 'q2', type: 'text' }])).toBe(true)
  })
  it('treats long_text / textarea / open_text as open-ended', () => {
    expect(hasOpenEndedQuestion([{ type: 'long_text' }])).toBe(true)
    expect(hasOpenEndedQuestion([{ type: 'textarea' }])).toBe(true)
    expect(hasOpenEndedQuestion([{ type: 'open_text' }])).toBe(true)
  })
  it('returns false for rating-only surveys', () => {
    expect(hasOpenEndedQuestion([{ type: 'rating' }, { type: 'rating' }])).toBe(false)
  })
  it('safe for non-array input', () => {
    expect(hasOpenEndedQuestion(null)).toBe(false)
    expect(hasOpenEndedQuestion('text')).toBe(false)
  })
})

describe('projectResponseRow', () => {
  const baseRow: SurveyResponseRow = {
    id: 'r1', surveyId: 'srv1', brandId: 'br1', memberId: 'm1',
    answers: { q1: 9, q2: 'Great' }, score: 9, sentiment: 0.5,
    confidence: 0.9, topics: ['support'], summary: 'Happy.',
    channel: 'email', completedAt: new Date('2026-05-18T18:00:00Z'),
    importedAt: null, distributionBatchId: null, importBatchId: null,
    member: { id: 'm1', firstName: 'Jane', lastName: 'Cooper', email: 'jane@cooper.com', phone: '+15551234', externalId: 'cust_1' },
    distributionBatch: null, importBatch: null,
  } as SurveyResponseRow

  it('renders email identifier for EMAIL-keyed brand', () => {
    const projected = projectResponseRow(baseRow, { memberIdentifierKind: 'EMAIL' })
    expect(projected.member?.identifierValue).toBe('jane@cooper.com')
  })
  it('renders phone identifier for PHONE-keyed brand', () => {
    const projected = projectResponseRow(baseRow, { memberIdentifierKind: 'PHONE' })
    expect(projected.member?.identifierValue).toBe('+15551234')
  })
  it('renders externalId for CUSTOMER_ID-keyed brand', () => {
    const projected = projectResponseRow(baseRow, { memberIdentifierKind: 'CUSTOMER_ID' })
    expect(projected.member?.identifierValue).toBe('cust_1')
  })
  it('returns `member: null` when the row has no memberId', () => {
    const anon: SurveyResponseRow = { ...baseRow, memberId: null, member: null }
    const projected = projectResponseRow(anon, { memberIdentifierKind: 'EMAIL' })
    expect(projected.member).toBeNull()
  })
})
