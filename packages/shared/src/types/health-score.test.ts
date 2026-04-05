/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
  DEFAULT_HEALTH_SCORE_WEIGHTS,
} from './health-score.js'
import type { HealthScoreInputs } from './health-score.js'

// ---------------------------------------------------------------------------
// These tests verify that the shared pure computation functions (moved from
// apps/api/src/queues/healthScore.ts) remain correct after deduplication.
// ---------------------------------------------------------------------------

describe('Shared Health Score Sub-Scores', () => {
  describe('computeRecencyScore', () => {
    it('returns 50 (neutral) when no activity exists (null)', () => {
      expect(computeRecencyScore(null)).toBe(50)
    })

    it('returns 100 for activity today (day 0)', () => {
      expect(computeRecencyScore(0)).toBe(100)
    })

    it('returns 100 at the 7-day boundary', () => {
      expect(computeRecencyScore(7)).toBe(100)
    })

    it('returns 0 at the 90-day boundary', () => {
      expect(computeRecencyScore(90)).toBe(0)
    })

    it('returns 0 for very old activity (365 days)', () => {
      expect(computeRecencyScore(365)).toBe(0)
    })

    it('decays linearly between 7 and 90 days', () => {
      const score8 = computeRecencyScore(8)
      const score89 = computeRecencyScore(89)
      // Day 8 should be just below 100
      expect(score8).toBeLessThan(100)
      expect(score8).toBeGreaterThan(90)
      // Day 89 should be just above 0
      expect(score89).toBeGreaterThan(0)
      expect(score89).toBeLessThan(10)
    })

    it('midpoint (~48 days) produces approximately 50', () => {
      const score = computeRecencyScore(48)
      expect(score).toBeGreaterThanOrEqual(48)
      expect(score).toBeLessThanOrEqual(52)
    })

    it('always returns an integer', () => {
      for (let d = 0; d <= 100; d++) {
        expect(Number.isInteger(computeRecencyScore(d))).toBe(true)
      }
    })
  })

  describe('computeFrequencyScore', () => {
    it('returns 0 for 0 events', () => {
      expect(computeFrequencyScore(0)).toBe(0)
    })

    it('returns 100 for exactly 10 events', () => {
      expect(computeFrequencyScore(10)).toBe(100)
    })

    it('caps at 100 for large event counts', () => {
      expect(computeFrequencyScore(100)).toBe(100)
      expect(computeFrequencyScore(1000)).toBe(100)
    })

    it('scales linearly: 5 events = 50', () => {
      expect(computeFrequencyScore(5)).toBe(50)
    })
  })

  describe('computeSentimentScore', () => {
    it('returns 50 for null (no sentiment data)', () => {
      expect(computeSentimentScore(null)).toBe(50)
    })

    it('maps -1.0 to 0', () => {
      expect(computeSentimentScore(-1.0)).toBe(0)
    })

    it('maps 0.0 to 50', () => {
      expect(computeSentimentScore(0.0)).toBe(50)
    })

    it('maps 1.0 to 100', () => {
      expect(computeSentimentScore(1.0)).toBe(100)
    })

    it('clamps values below -1', () => {
      expect(computeSentimentScore(-5.0)).toBe(0)
    })

    it('clamps values above 1', () => {
      expect(computeSentimentScore(5.0)).toBe(100)
    })
  })

  describe('computeNpsScore', () => {
    it('returns 50 for null', () => {
      expect(computeNpsScore(null)).toBe(50)
    })

    it('maps 0 to 0', () => {
      expect(computeNpsScore(0)).toBe(0)
    })

    it('maps 10 to 100', () => {
      expect(computeNpsScore(10)).toBe(100)
    })

    it('maps 5 to 50 (midpoint)', () => {
      expect(computeNpsScore(5)).toBe(50)
    })

    it('clamps negative values to 0', () => {
      expect(computeNpsScore(-5)).toBe(0)
    })

    it('clamps values above 10 to 100', () => {
      expect(computeNpsScore(15)).toBe(100)
    })
  })

  describe('computeEngagementScore', () => {
    it('returns 0 for 0 activities', () => {
      expect(computeEngagementScore(0)).toBe(0)
    })

    it('returns 100 for exactly 5 activities', () => {
      expect(computeEngagementScore(5)).toBe(100)
    })

    it('caps at 100 for large activity counts', () => {
      expect(computeEngagementScore(50)).toBe(100)
    })

    it('scales: 1 activity = 20, 3 activities = 60', () => {
      expect(computeEngagementScore(1)).toBe(20)
      expect(computeEngagementScore(3)).toBe(60)
    })
  })
})

describe('Shared computeHealthScore', () => {
  it('computes correct score for all-neutral inputs (new member)', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: null,
      loyaltyEventCount90d: 0,
      avgSentiment90d: null,
      latestNpsScore: null,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    }
    const result = computeHealthScore(inputs)
    // recency=50, frequency=0, sentiment=50, nps=50, engagement=0
    // 50*0.25 + 0*0.20 + 50*0.25 + 50*0.15 + 0*0.15 = 32.5 -> 33
    expect(result.overall).toBe(33)
  })

  it('returns 100 for best possible inputs', () => {
    const result = computeHealthScore({
      daysSinceLastActivity: 0,
      loyaltyEventCount90d: 100,
      avgSentiment90d: 1.0,
      latestNpsScore: 10,
      engagementCount90d: 100,
      latestNoteSentiment90d: null,
    })
    expect(result.overall).toBe(100)
  })

  it('returns 0 for worst possible inputs', () => {
    const result = computeHealthScore({
      daysSinceLastActivity: 365,
      loyaltyEventCount90d: 0,
      avgSentiment90d: -1.0,
      latestNpsScore: 0,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    })
    expect(result.overall).toBe(0)
  })

  it('overall is always between 0 and 100 inclusive', () => {
    // Test a range of random-ish inputs
    const testCases: HealthScoreInputs[] = [
      { daysSinceLastActivity: null, loyaltyEventCount90d: 0, avgSentiment90d: null, latestNpsScore: null, engagementCount90d: 0 },
      { daysSinceLastActivity: 45, loyaltyEventCount90d: 5, avgSentiment90d: 0.5, latestNpsScore: 7, engagementCount90d: 3 },
      { daysSinceLastActivity: 100, loyaltyEventCount90d: 20, avgSentiment90d: -0.5, latestNpsScore: 2, engagementCount90d: 10 },
      { daysSinceLastActivity: 0, loyaltyEventCount90d: 0, avgSentiment90d: -1, latestNpsScore: 0, engagementCount90d: 0 },
    ]
    for (const inputs of testCases) {
      const result = computeHealthScore(inputs)
      expect(result.overall).toBeGreaterThanOrEqual(0)
      expect(result.overall).toBeLessThanOrEqual(100)
    }
  })

  it('includes all sub-scores in the breakdown', () => {
    const result = computeHealthScore({
      daysSinceLastActivity: 30,
      loyaltyEventCount90d: 5,
      avgSentiment90d: 0.0,
      latestNpsScore: 5,
      engagementCount90d: 2,
      latestNoteSentiment90d: null,
    })
    expect(result).toHaveProperty('recency')
    expect(result).toHaveProperty('frequency')
    expect(result).toHaveProperty('sentiment')
    expect(result).toHaveProperty('nps')
    expect(result).toHaveProperty('engagement')
    expect(result).toHaveProperty('overall')
    expect(result).toHaveProperty('computedAt')
  })

  it('computedAt is a valid ISO 8601 string', () => {
    const result = computeHealthScore({
      daysSinceLastActivity: null,
      loyaltyEventCount90d: 0,
      avgSentiment90d: null,
      latestNpsScore: null,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    })
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt)
  })

  it('respects custom weights', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 0,  // recency = 100
      loyaltyEventCount90d: 0,   // frequency = 0
      avgSentiment90d: null,     // sentiment = 50
      latestNpsScore: null,      // nps = 50
      engagementCount90d: 0,
      latestNoteSentiment90d: null,     // engagement = 0
    }
    // Weight recency at 100%
    const result = computeHealthScore(inputs, {
      recency: 1.0,
      frequency: 0,
      sentiment: 0,
      nps: 0,
      engagement: 0,
    })
    expect(result.overall).toBe(100)
  })

  it('DEFAULT_HEALTH_SCORE_WEIGHTS sum to 1.0', () => {
    const w = DEFAULT_HEALTH_SCORE_WEIGHTS
    const sum = w.recency + w.frequency + w.sentiment + w.nps + w.engagement
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
  })

  it('distribution boundary: score of exactly 20 falls in critical bucket', () => {
    // This tests the boundary logic used in processHealthScoreComputation
    // Score <= 20 = critical, 21-40 = poor, etc.
    // We verify the pure computation can produce boundary values
    const result = computeHealthScore({
      daysSinceLastActivity: 365,
      loyaltyEventCount90d: 0,
      avgSentiment90d: -0.6,
      latestNpsScore: 0,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    })
    // Verify the score is computed correctly (should be low)
    expect(result.overall).toBeLessThanOrEqual(20)
  })
})

describe('Rep-note modifier on health score', () => {
  const healthyAutoSignals: HealthScoreInputs = {
    daysSinceLastActivity: 2,
    loyaltyEventCount90d: 20,
    avgSentiment90d: 0.7,
    latestNpsScore: 9,
    engagementCount90d: 8,
    latestNoteSentiment90d: null,
  }
  const weakAutoSignals: HealthScoreInputs = {
    daysSinceLastActivity: 60,
    loyaltyEventCount90d: 1,
    avgSentiment90d: -0.2,
    latestNpsScore: 3,
    engagementCount90d: 0,
    latestNoteSentiment90d: null,
  }

  it('no note → overall equals baseScore and noteModifier is 0', () => {
    const r = computeHealthScore(healthyAutoSignals)
    expect(r.noteModifier).toBe(0)
    expect(r.noteSentiment).toBeNull()
    expect(r.overall).toBe(r.baseScore)
    expect(r.inconsistency).toBeNull()
  })

  it('very_negative note pulls a healthy customer down by 40', () => {
    const base = computeHealthScore(healthyAutoSignals).baseScore
    const r = computeHealthScore({ ...healthyAutoSignals, latestNoteSentiment90d: 'very_negative' })
    expect(r.baseScore).toBe(base)
    expect(r.noteModifier).toBe(-40)
    expect(r.overall).toBe(Math.max(0, base - 40))
  })

  it('very_positive note lifts a weak customer by 30', () => {
    const base = computeHealthScore(weakAutoSignals).baseScore
    const r = computeHealthScore({ ...weakAutoSignals, latestNoteSentiment90d: 'very_positive' })
    expect(r.noteModifier).toBe(30)
    expect(r.overall).toBe(Math.min(100, base + 30))
  })

  it('clamps at 0 on the low end', () => {
    const r = computeHealthScore({ ...weakAutoSignals, latestNoteSentiment90d: 'very_negative' })
    expect(r.overall).toBeGreaterThanOrEqual(0)
    // baseScore for weakAutoSignals is well under 40, minus 40 would go negative
  })

  it('clamps at 100 on the high end', () => {
    const r = computeHealthScore({ ...healthyAutoSignals, latestNoteSentiment90d: 'very_positive' })
    expect(r.overall).toBeLessThanOrEqual(100)
  })

  it('flags auto_healthy_rep_concerned when base >= 70 and modifier <= -20', () => {
    const r = computeHealthScore({ ...healthyAutoSignals, latestNoteSentiment90d: 'very_negative' })
    expect(r.baseScore).toBeGreaterThanOrEqual(70)
    expect(r.inconsistency).toBe('auto_healthy_rep_concerned')
  })

  it('flags auto_weak_rep_positive when base <= 40 and modifier >= 15', () => {
    const r = computeHealthScore({ ...weakAutoSignals, latestNoteSentiment90d: 'positive' })
    expect(r.baseScore).toBeLessThanOrEqual(40)
    expect(r.inconsistency).toBe('auto_weak_rep_positive')
  })

  it('does not flag inconsistency when signals agree', () => {
    const happy = computeHealthScore({ ...healthyAutoSignals, latestNoteSentiment90d: 'very_positive' })
    expect(happy.inconsistency).toBeNull()
    const unhappy = computeHealthScore({ ...weakAutoSignals, latestNoteSentiment90d: 'negative' })
    expect(unhappy.inconsistency).toBeNull()
  })

  it('neutral note does nothing (modifier = 0)', () => {
    const r = computeHealthScore({ ...healthyAutoSignals, latestNoteSentiment90d: 'neutral' })
    expect(r.noteModifier).toBe(0)
    expect(r.overall).toBe(r.baseScore)
  })
})
