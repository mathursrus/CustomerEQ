import { describe, it, expect } from 'vitest'
import {
  SENTIMENT,
  NPS,
  CSAT,
  CES,
  defaultScaleForType,
  shouldShowScoreBand,
  shouldShowSentimentBand,
  sentimentBandOf,
  EXPORT_ROW_CAP,
  EXPORTS_POWERED_BY_URL,
  PUBLIC_FRONTEND_HOST,
  PUBLIC_FRONTEND_URL,
  PUBLIC_ADMIN_UI_URL,
  PUBLIC_API_URL,
  AI_FIELDS_CAVEAT,
} from './constants.js'

describe('SENTIMENT (existing thresholds preserved)', () => {
  it('classifies > +0.3 as positive (strict)', () => {
    expect(SENTIMENT.classify(0.31)).toBe('positive')
    expect(SENTIMENT.classify(0.3)).toBe('neutral')  // boundary not inclusive
  })
  it('classifies < -0.3 as negative (strict)', () => {
    expect(SENTIMENT.classify(-0.31)).toBe('negative')
    expect(SENTIMENT.classify(-0.3)).toBe('neutral')
  })
  it('classifies 0 as neutral', () => {
    expect(SENTIMENT.classify(0)).toBe('neutral')
  })
})

describe('NPS bandsForScale', () => {
  it('0-10 default scale produces correct band ranges', () => {
    const t = NPS.bandsForScale('0_10')
    expect(t.scale).toBe('0_10')
    expect(t.bandOf(10)).toBe('promoter')
    expect(t.bandOf(9)).toBe('promoter')
    expect(t.bandOf(8)).toBe('passive')
    expect(t.bandOf(7)).toBe('passive')
    expect(t.bandOf(6)).toBe('detractor')
    expect(t.bandOf(0)).toBe('detractor')
  })
  it('addresses the future 1-5 scale without throwing', () => {
    const t = NPS.bandsForScale('1_5')
    expect(t.scale).toBe('1_5')
    expect(t.bandOf(5)).toBe('promoter')
    expect(t.bandOf(4)).toBe('passive')
    expect(t.bandOf(3)).toBe('detractor')
    expect(t.bandOf(1)).toBe('detractor')
  })
  it('preserves existing back-compat helpers', () => {
    expect(NPS.PROMOTER_THRESHOLD).toBe(9)
    expect(NPS.DETRACTOR_THRESHOLD).toBe(6)
    expect(NPS.isPromoter(9)).toBe(true)
    expect(NPS.isPromoter(8)).toBe(false)
    expect(NPS.isDetractor(6)).toBe(true)
    expect(NPS.isDetractor(7)).toBe(false)
  })
})

describe('CSAT bandsForScale', () => {
  it('1-5 scale produces top-2-box / neutral / bottom-2-box', () => {
    const t = CSAT.bandsForScale('1_5')
    expect(t.bandOf(5)).toBe('satisfied')
    expect(t.bandOf(4)).toBe('satisfied')
    expect(t.bandOf(3)).toBe('neutral')
    expect(t.bandOf(2)).toBe('dissatisfied')
    expect(t.bandOf(1)).toBe('dissatisfied')
  })
})

describe('CES bandsForScale', () => {
  it('1-7 default scale (modern CES 2.0; high = easy)', () => {
    const t = CES.bandsForScale('1_7')
    expect(t.bandOf(7)).toBe('easy')
    expect(t.bandOf(5)).toBe('easy')
    expect(t.bandOf(4)).toBe('neutral')
    expect(t.bandOf(3)).toBe('hard')
    expect(t.bandOf(1)).toBe('hard')
  })
  it('addresses the future 1-5 scale without throwing', () => {
    const t = CES.bandsForScale('1_5')
    expect(t.bandOf(5)).toBe('easy')
    expect(t.bandOf(4)).toBe('neutral')
    expect(t.bandOf(1)).toBe('hard')
  })
})

describe('defaultScaleForType', () => {
  it('returns the Phase-1 default scale per type', () => {
    expect(defaultScaleForType('NPS')).toBe('0_10')
    expect(defaultScaleForType('CSAT')).toBe('1_5')
    expect(defaultScaleForType('CES')).toBe('1_7')
  })
})

describe('shouldShowScoreBand', () => {
  it('returns true only for the three standard CX types', () => {
    expect(shouldShowScoreBand('NPS')).toBe(true)
    expect(shouldShowScoreBand('CSAT')).toBe(true)
    expect(shouldShowScoreBand('CES')).toBe(true)
    expect(shouldShowScoreBand('CUSTOM')).toBe(false)
    expect(shouldShowScoreBand('OTHER')).toBe(false)
    expect(shouldShowScoreBand('')).toBe(false)
  })
})

describe('shouldShowSentimentBand', () => {
  it('requires both CX type AND at least one open-ended question', () => {
    expect(shouldShowSentimentBand('NPS', true)).toBe(true)
    expect(shouldShowSentimentBand('NPS', false)).toBe(false)
    expect(shouldShowSentimentBand('CSAT', true)).toBe(true)
    expect(shouldShowSentimentBand('CUSTOM', true)).toBe(false)
    expect(shouldShowSentimentBand('CUSTOM', false)).toBe(false)
  })
})

describe('sentimentBandOf', () => {
  it('respects strict-inequality boundaries (matches SENTIMENT.classify)', () => {
    expect(sentimentBandOf(0.31)).toBe('positive')
    expect(sentimentBandOf(0.3)).toBe('neutral')
    expect(sentimentBandOf(0)).toBe('neutral')
    expect(sentimentBandOf(-0.3)).toBe('neutral')
    expect(sentimentBandOf(-0.31)).toBe('negative')
  })
  it('returns null for null / undefined', () => {
    expect(sentimentBandOf(null)).toBeNull()
  })
})

describe('export controls', () => {
  it('EXPORT_ROW_CAP is the Phase-1 50k value', () => {
    expect(EXPORT_ROW_CAP).toBe(50_000)
  })
  it('EXPORTS_POWERED_BY_URL is the canonical production host', () => {
    expect(EXPORTS_POWERED_BY_URL).toBe('https://customereq.wellnessatwork.me')
  })
  // Issue #540 — single source of truth for the public host.
  it('PUBLIC_FRONTEND_HOST is the bare canonical host (no scheme)', () => {
    expect(PUBLIC_FRONTEND_HOST).toBe('customereq.wellnessatwork.me')
  })
  it('PUBLIC_FRONTEND_URL is derived from PUBLIC_FRONTEND_HOST (cannot drift)', () => {
    expect(PUBLIC_FRONTEND_URL).toBe(`https://${PUBLIC_FRONTEND_HOST}`)
  })
  it('EXPORTS_POWERED_BY_URL is aliased to PUBLIC_FRONTEND_URL (cannot drift)', () => {
    expect(EXPORTS_POWERED_BY_URL).toBe(PUBLIC_FRONTEND_URL)
  })
  it('PUBLIC_ADMIN_UI_URL is aliased to PUBLIC_FRONTEND_URL (admin + respondent share the apex host)', () => {
    expect(PUBLIC_ADMIN_UI_URL).toBe(PUBLIC_FRONTEND_URL)
  })
  // Issue #540 scope decision A: API has no custom domain yet; legacy Azure
  // FQDN is the canonical default. Follow-up issue tracks custom-domain binding.
  it('PUBLIC_API_URL is the production API origin (https + valid host)', () => {
    expect(PUBLIC_API_URL).toMatch(/^https:\/\/[^/]+$/)
    expect(PUBLIC_API_URL).not.toMatch(/customerEQ\.io|localhost/i)
  })
  it('AI_FIELDS_CAVEAT contains the required key phrases (single source of truth)', () => {
    expect(AI_FIELDS_CAVEAT).toContain('AI-derived columns')
    expect(AI_FIELDS_CAVEAT).toContain('AI · Sentiment')
    expect(AI_FIELDS_CAVEAT).toContain('AI · Topics')
    expect(AI_FIELDS_CAVEAT).toContain('AI · Summary')
    expect(AI_FIELDS_CAVEAT).toContain('open-ended')
    // Operator-facing copy never names internal issue numbers (R6a):
    expect(AI_FIELDS_CAVEAT).not.toMatch(/#\d+/)
    expect(AI_FIELDS_CAVEAT).not.toMatch(/\bIssue\b/)
  })
})
