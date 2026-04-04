export interface HealthScoreComputationPayload {
  brandId: string
  memberId?: string // if provided, recompute only this member; otherwise all active members
}

export interface HealthScoreWeights {
  recency: number // default 0.25
  frequency: number // default 0.20
  sentiment: number // default 0.25
  nps: number // default 0.15
  engagement: number // default 0.15
}

export interface HealthScoreBreakdown {
  recency: number
  frequency: number
  sentiment: number
  nps: number
  engagement: number
  overall: number
  computedAt: string // ISO 8601
}

export const DEFAULT_HEALTH_SCORE_WEIGHTS: HealthScoreWeights = {
  recency: 0.25,
  frequency: 0.20,
  sentiment: 0.25,
  nps: 0.15,
  engagement: 0.15,
}

// ---------------------------------------------------------------------------
// Pure sub-score computation functions (no DB access)
// ---------------------------------------------------------------------------

/**
 * Recency sub-score: 100 if within 7 days, linear decay to 0 at 90 days, 0 if >90 days.
 */
export function computeRecencyScore(daysSinceLastActivity: number | null): number {
  if (daysSinceLastActivity === null) return 50 // no activity — neutral default
  if (daysSinceLastActivity <= 7) return 100
  if (daysSinceLastActivity >= 90) return 0
  return Math.round(100 * (90 - daysSinceLastActivity) / (90 - 7))
}

/**
 * Frequency sub-score: 100 if >= 10 events in last 90 days, linear scale from 0-10.
 */
export function computeFrequencyScore(eventCount: number): number {
  if (eventCount >= 10) return 100
  return Math.round((eventCount / 10) * 100)
}

/**
 * Sentiment sub-score: maps [-1.0, 1.0] to [0, 100]. Null (no surveys) = 50 (neutral).
 */
export function computeSentimentScore(avgSentiment: number | null): number {
  if (avgSentiment === null) return 50
  const clamped = Math.max(-1, Math.min(1, avgSentiment))
  return Math.round(((clamped + 1) / 2) * 100)
}

/**
 * NPS sub-score: maps [0, 10] to [0, 100]. Null = 50 (neutral).
 */
export function computeNpsScore(latestScore: number | null): number {
  if (latestScore === null) return 50
  const clamped = Math.max(0, Math.min(10, latestScore))
  return Math.round((clamped / 10) * 100)
}

/**
 * Engagement sub-score: 100 if >= 5 activities (campaigns + redemptions) in last 90 days, linear 0-5.
 */
export function computeEngagementScore(activityCount: number): number {
  if (activityCount >= 5) return 100
  return Math.round((activityCount / 5) * 100)
}

export interface HealthScoreInputs {
  daysSinceLastActivity: number | null
  loyaltyEventCount90d: number
  avgSentiment90d: number | null
  latestNpsScore: number | null
  engagementCount90d: number
}

/**
 * Computes the overall health score (0-100) from input signals.
 * Pure function with no side effects.
 */
export function computeHealthScore(
  inputs: HealthScoreInputs,
  weights: HealthScoreWeights = DEFAULT_HEALTH_SCORE_WEIGHTS,
): HealthScoreBreakdown {
  const recency = computeRecencyScore(inputs.daysSinceLastActivity)
  const frequency = computeFrequencyScore(inputs.loyaltyEventCount90d)
  const sentiment = computeSentimentScore(inputs.avgSentiment90d)
  const nps = computeNpsScore(inputs.latestNpsScore)
  const engagement = computeEngagementScore(inputs.engagementCount90d)

  const overall = Math.round(
    recency * weights.recency +
    frequency * weights.frequency +
    sentiment * weights.sentiment +
    nps * weights.nps +
    engagement * weights.engagement
  )

  return {
    recency,
    frequency,
    sentiment,
    nps,
    engagement,
    overall,
    computedAt: new Date().toISOString(),
  }
}
