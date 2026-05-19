import { describe, it, expect } from 'vitest'
import {
  ResponseFiltersSchema,
  ResponseListQuerySchema,
  WaveSelection,
  splitCsvArray,
} from './responseFilters.schema.js'

describe('WaveSelection', () => {
  it('accepts the literal sentinels', () => {
    expect(WaveSelection.parse('all')).toBe('all')
    expect(WaveSelection.parse('direct')).toBe('direct')
  })
  it('accepts a cuid-shaped batchId', () => {
    const cuid = 'cabcdefghij1234567890klmn'
    expect(WaveSelection.parse(cuid)).toBe(cuid)
  })
  it('rejects an obviously-malformed batchId', () => {
    expect(() => WaveSelection.parse('not-a-cuid')).toThrow()
    expect(() => WaveSelection.parse('123')).toThrow()
  })
})

describe('ResponseFiltersSchema', () => {
  it('defaults `wave` to "all" when omitted', () => {
    const parsed = ResponseFiltersSchema.parse({})
    expect(parsed.wave).toBe('all')
  })
  it('accepts well-formed YYYY-MM-DD date strings', () => {
    const parsed = ResponseFiltersSchema.parse({
      submittedFrom: '2026-04-15',
      submittedTo: '2026-04-22',
    })
    expect(parsed.submittedFrom).toBe('2026-04-15')
    expect(parsed.submittedTo).toBe('2026-04-22')
  })
  it('rejects malformed date strings', () => {
    expect(() => ResponseFiltersSchema.parse({ submittedFrom: '04/15/2026' })).toThrow()
    expect(() => ResponseFiltersSchema.parse({ submittedFrom: '2026-4-15' })).toThrow()
  })
  it('accepts the documented score bands across types', () => {
    const parsed = ResponseFiltersSchema.parse({
      scoreBands: ['promoter', 'detractor', 'satisfied', 'dissatisfied', 'easy', 'hard'],
    })
    expect(parsed.scoreBands).toContain('promoter')
    expect(parsed.scoreBands).toContain('hard')
  })
  it('rejects unknown score-band values', () => {
    expect(() => ResponseFiltersSchema.parse({ scoreBands: ['great'] })).toThrow()
  })
  it('accepts positive/neutral/negative sentiment bands', () => {
    const parsed = ResponseFiltersSchema.parse({
      sentimentBands: ['positive', 'neutral', 'negative'],
    })
    expect(parsed.sentimentBands?.length).toBe(3)
  })
  it('accepts a free-form channel list', () => {
    const parsed = ResponseFiltersSchema.parse({ channels: ['email', 'sms', 'review'] })
    expect(parsed.channels).toEqual(['email', 'sms', 'review'])
  })
})

describe('ResponseListQuerySchema (R11 / R11a)', () => {
  it('defaults page=1, pageSize=25 when omitted', () => {
    const parsed = ResponseListQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(25)
  })
  it('coerces stringified numeric query params', () => {
    const parsed = ResponseListQuerySchema.parse({ page: '3', pageSize: '50' })
    expect(parsed.page).toBe(3)
    expect(parsed.pageSize).toBe(50)
  })
  it('accepts the direct-API pageSize cap (500)', () => {
    const parsed = ResponseListQuerySchema.parse({ pageSize: 500 })
    expect(parsed.pageSize).toBe(500)
  })
  it('rejects pageSize > 500', () => {
    expect(() => ResponseListQuerySchema.parse({ pageSize: 501 })).toThrow()
  })
  it('rejects page < 1', () => {
    expect(() => ResponseListQuerySchema.parse({ page: 0 })).toThrow()
  })
})

describe('splitCsvArray', () => {
  it('returns undefined for empty/null/undefined', () => {
    expect(splitCsvArray(undefined)).toBeUndefined()
    expect(splitCsvArray(null)).toBeUndefined()
    expect(splitCsvArray('')).toBeUndefined()
  })
  it('passes through arrays as strings', () => {
    expect(splitCsvArray(['a', 'b'])).toEqual(['a', 'b'])
  })
  it('splits a comma-separated string', () => {
    expect(splitCsvArray('email,sms,review')).toEqual(['email', 'sms', 'review'])
  })
  it('filters empty pieces ("a,,b")', () => {
    expect(splitCsvArray('a,,b')).toEqual(['a', 'b'])
  })
})
