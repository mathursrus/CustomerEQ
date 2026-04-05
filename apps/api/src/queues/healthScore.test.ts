/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
} from './healthScore.js'
import type { HealthScoreInputs } from './healthScore.js'
import { DEFAULT_HEALTH_SCORE_WEIGHTS } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Sub-score computation tests
// ---------------------------------------------------------------------------

describe('Health Score Sub-Scores', () => {
  describe('computeRecencyScore', () => {
    it('returns 50 (neutral) when no activity exists (null)', () => {
      expect(computeRecencyScore(null)).toBe(50)
    })

    it('returns 100 when activity is within 7 days', () => {
      expect(computeRecencyScore(0)).toBe(100)
      expect(computeRecencyScore(3)).toBe(100)
      expect(computeRecencyScore(7)).toBe(100)
    })

    it('returns 0 when activity is 90+ days ago', () => {
      expect(computeRecencyScore(90)).toBe(0)
      expect(computeRecencyScore(120)).toBe(0)
      expect(computeRecencyScore(365)).toBe(0)
    })

    it('decays linearly between 7 and 90 days', () => {
      // At day 48.5 (midpoint of 7-90), should be ~50
      const midpoint = Math.round(100 * (90 - 48) / (90 - 7))
      expect(computeRecencyScore(48)).toBe(midpoint)
    })

    it('returns a value strictly between 0 and 100 for days between 7 and 90', () => {
      const score = computeRecencyScore(30)
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(100)
    })
  })

  describe('computeFrequencyScore', () => {
    it('returns 0 for 0 events', () => {
      expect(computeFrequencyScore(0)).toBe(0)
    })

    it('returns 100 for 10 or more events', () => {
      expect(computeFrequencyScore(10)).toBe(100)
      expect(computeFrequencyScore(50)).toBe(100)
    })

    it('scales linearly from 0 to 10 events', () => {
      expect(computeFrequencyScore(5)).toBe(50)
      expect(computeFrequencyScore(1)).toBe(10)
    })
  })

  describe('computeSentimentScore', () => {
    it('returns 50 (neutral) when sentiment is null', () => {
      expect(computeSentimentScore(null)).toBe(50)
    })

    it('returns 0 for sentiment -1.0', () => {
      expect(computeSentimentScore(-1.0)).toBe(0)
    })

    it('returns 100 for sentiment 1.0', () => {
      expect(computeSentimentScore(1.0)).toBe(100)
    })

    it('returns 50 for neutral sentiment 0.0', () => {
      expect(computeSentimentScore(0.0)).toBe(50)
    })

    it('clamps values outside [-1, 1]', () => {
      expect(computeSentimentScore(-2.0)).toBe(0)
      expect(computeSentimentScore(2.0)).toBe(100)
    })
  })

  describe('computeNpsScore', () => {
    it('returns 50 (neutral) when NPS score is null', () => {
      expect(computeNpsScore(null)).toBe(50)
    })

    it('returns 0 for NPS score 0', () => {
      expect(computeNpsScore(0)).toBe(0)
    })

    it('returns 100 for NPS score 10', () => {
      expect(computeNpsScore(10)).toBe(100)
    })

    it('maps NPS 5 to 50', () => {
      expect(computeNpsScore(5)).toBe(50)
    })

    it('clamps values outside [0, 10]', () => {
      expect(computeNpsScore(-3)).toBe(0)
      expect(computeNpsScore(15)).toBe(100)
    })
  })

  describe('computeEngagementScore', () => {
    it('returns 0 for 0 activities', () => {
      expect(computeEngagementScore(0)).toBe(0)
    })

    it('returns 100 for 5 or more activities', () => {
      expect(computeEngagementScore(5)).toBe(100)
      expect(computeEngagementScore(20)).toBe(100)
    })

    it('scales linearly from 0 to 5', () => {
      expect(computeEngagementScore(1)).toBe(20)
      expect(computeEngagementScore(3)).toBe(60)
    })
  })
})

// ---------------------------------------------------------------------------
// Composite health score tests
// ---------------------------------------------------------------------------

describe('computeHealthScore', () => {
  it('returns 50 for a new member with no history (all neutral defaults)', () => {
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
    // 50*0.25 + 0*0.20 + 50*0.25 + 50*0.15 + 0*0.15 = 12.5 + 0 + 12.5 + 7.5 + 0 = 32.5 → 33
    expect(result.overall).toBe(33)
    expect(result.recency).toBe(50)
    expect(result.frequency).toBe(0)
    expect(result.sentiment).toBe(50)
    expect(result.nps).toBe(50)
    expect(result.engagement).toBe(0)
  })

  it('returns high score for active member with positive signals', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 2,   // recent — recency = 100
      loyaltyEventCount90d: 15,   // frequent — frequency = 100
      avgSentiment90d: 0.8,       // positive — sentiment = 90
      latestNpsScore: 9,          // promoter — nps = 90
      engagementCount90d: 8,
      latestNoteSentiment90d: null,      // engaged — engagement = 100
    }
    const result = computeHealthScore(inputs)

    // 100*0.25 + 100*0.20 + 90*0.25 + 90*0.15 + 100*0.15
    // = 25 + 20 + 22.5 + 13.5 + 15 = 96
    expect(result.overall).toBe(96)
    expect(result.overall).toBeGreaterThan(75)
  })

  it('returns low score for churning member with negative signals', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 100,  // long gone — recency = 0
      loyaltyEventCount90d: 0,     // no events — frequency = 0
      avgSentiment90d: -0.8,       // negative — sentiment = 10
      latestNpsScore: 1,           // detractor — nps = 10
      engagementCount90d: 0,
      latestNoteSentiment90d: null,       // no engagement — engagement = 0
    }
    const result = computeHealthScore(inputs)

    // 0*0.25 + 0*0.20 + 10*0.25 + 10*0.15 + 0*0.15
    // = 0 + 0 + 2.5 + 1.5 + 0 = 4
    expect(result.overall).toBe(4)
    expect(result.overall).toBeLessThan(30)
  })

  it('returns moderate score for member with mixed signals', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 30,  // some decay
      loyaltyEventCount90d: 5,    // moderate
      avgSentiment90d: 0.0,       // neutral
      latestNpsScore: 5,          // passive
      engagementCount90d: 2,
      latestNoteSentiment90d: null,      // low
    }
    const result = computeHealthScore(inputs)
    expect(result.overall).toBeGreaterThan(30)
    expect(result.overall).toBeLessThan(70)
  })

  it('includes computedAt as an ISO 8601 string', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: null,
      loyaltyEventCount90d: 0,
      avgSentiment90d: null,
      latestNpsScore: null,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    }
    const result = computeHealthScore(inputs)
    expect(result.computedAt).toBeDefined()
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt)
  })

  it('accepts custom weights', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 2,   // recency = 100
      loyaltyEventCount90d: 0,    // frequency = 0
      avgSentiment90d: null,      // sentiment = 50
      latestNpsScore: null,       // nps = 50
      engagementCount90d: 0,
      latestNoteSentiment90d: null,      // engagement = 0
    }

    // Heavily weight recency
    const weights = {
      recency: 0.80,
      frequency: 0.05,
      sentiment: 0.05,
      nps: 0.05,
      engagement: 0.05,
    }

    const result = computeHealthScore(inputs, weights)
    // 100*0.80 + 0*0.05 + 50*0.05 + 50*0.05 + 0*0.05 = 80 + 0 + 2.5 + 2.5 + 0 = 85
    expect(result.overall).toBe(85)
  })

  it('overall score is always between 0 and 100', () => {
    // Best possible score
    const best = computeHealthScore({
      daysSinceLastActivity: 0,
      loyaltyEventCount90d: 100,
      avgSentiment90d: 1.0,
      latestNpsScore: 10,
      engagementCount90d: 100,
      latestNoteSentiment90d: null,
    })
    expect(best.overall).toBe(100)

    // Worst possible score
    const worst = computeHealthScore({
      daysSinceLastActivity: 365,
      loyaltyEventCount90d: 0,
      avgSentiment90d: -1.0,
      latestNpsScore: 0,
      engagementCount90d: 0,
      latestNoteSentiment90d: null,
    })
    expect(worst.overall).toBe(0)
  })

  it('uses DEFAULT_HEALTH_SCORE_WEIGHTS when no weights are provided', () => {
    const inputs: HealthScoreInputs = {
      daysSinceLastActivity: 0,
      loyaltyEventCount90d: 10,
      avgSentiment90d: 1.0,
      latestNpsScore: 10,
      engagementCount90d: 5,
      latestNoteSentiment90d: null,
    }
    const withDefault = computeHealthScore(inputs)
    const withExplicit = computeHealthScore(inputs, DEFAULT_HEALTH_SCORE_WEIGHTS)
    expect(withDefault.overall).toBe(withExplicit.overall)
  })
})
