import { describe, it, expect } from 'vitest'
import {
  ProgramHealthResponseSchema,
  InsightSchema,
  CxHealthSchema,
  LoyaltyHealthSchema,
} from './programHealth.schema.js'

describe('ProgramHealthResponseSchema', () => {
  const validCxHealth = {
    avgNps: 42,
    activeSurveys: 3,
    responseRate: 18.5,
    atRiskCount: 7,
  }

  const validLoyaltyHealth = {
    activeMembers: 100,
    pointsIssuedThisWeek: 5000,
    redemptionRate: 12.3,
    activeCampaigns: 2,
  }

  const validInsight = {
    id: 'detractors-no-redemption',
    message: '7 detractors have not redeemed a reward in 30 days',
    ctaLabel: 'Create win-back campaign',
    ctaHref: '/admin/campaigns/new?filter=detractors&maxNps=6',
    severity: 'warning' as const,
  }

  it('parses a full valid response', () => {
    const result = ProgramHealthResponseSchema.safeParse({
      cxHealth: validCxHealth,
      loyaltyHealth: validLoyaltyHealth,
      insights: [validInsight],
    })
    expect(result.success).toBe(true)
  })

  it('accepts null cxHealth and loyaltyHealth (partial failure)', () => {
    const result = ProgramHealthResponseSchema.safeParse({
      cxHealth: null,
      loyaltyHealth: null,
      insights: [],
      warnings: ['cx query timed out'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cxHealth).toBeNull()
      expect(result.data.warnings).toEqual(['cx query timed out'])
    }
  })

  it('accepts empty insights array', () => {
    const result = ProgramHealthResponseSchema.safeParse({
      cxHealth: validCxHealth,
      loyaltyHealth: validLoyaltyHealth,
      insights: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative atRiskCount', () => {
    const result = CxHealthSchema.safeParse({ ...validCxHealth, atRiskCount: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects negative activeMembers', () => {
    const result = LoyaltyHealthSchema.safeParse({ ...validLoyaltyHealth, activeMembers: -5 })
    expect(result.success).toBe(false)
  })

  it('allows null avgNps', () => {
    const result = CxHealthSchema.safeParse({ ...validCxHealth, avgNps: null })
    expect(result.success).toBe(true)
  })

  it('rejects invalid insight severity', () => {
    const result = InsightSchema.safeParse({ ...validInsight, severity: 'critical' })
    expect(result.success).toBe(false)
  })

  it('insight ctaLabel and ctaHref are optional', () => {
    const result = InsightSchema.safeParse({
      id: 'low-response-rate',
      message: 'Your survey response rate is 5%',
      severity: 'warning',
    })
    expect(result.success).toBe(true)
  })

  it('rejects response missing required fields', () => {
    const result = ProgramHealthResponseSchema.safeParse({ insights: [] })
    expect(result.success).toBe(false)
  })
})
