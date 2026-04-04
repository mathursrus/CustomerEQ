import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type {
  HealthScoreWeights,
  HealthScoreBreakdown,
  HealthScoreComputationPayload,
} from '@customerEQ/shared'
import { DEFAULT_HEALTH_SCORE_WEIGHTS } from '@customerEQ/shared'

const log = pino({ name: 'health-score' })

// ---------------------------------------------------------------------------
// Sub-score computation (pure functions — no DB access)
// ---------------------------------------------------------------------------

/**
 * Recency sub-score: 100 if within 7 days, linear decay to 0 at 90 days, 0 if >90 days.
 */
export function computeRecencyScore(daysSinceLastActivity: number | null): number {
  if (daysSinceLastActivity === null) return 50 // no activity — neutral default
  if (daysSinceLastActivity <= 7) return 100
  if (daysSinceLastActivity >= 90) return 0
  // Linear decay from 100 at day 7 to 0 at day 90
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
  // Clamp to [-1, 1]
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

// ---------------------------------------------------------------------------
// Composite health score computation (pure function)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Database signal fetchers
// ---------------------------------------------------------------------------

/**
 * Fetches all input signals for a member and computes health score breakdown.
 */
export async function computeHealthScoreForMember(
  memberId: string,
  brandId: string,
  weights: HealthScoreWeights = DEFAULT_HEALTH_SCORE_WEIGHTS,
): Promise<HealthScoreBreakdown> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // Run all queries in parallel for efficiency
  const [
    lastEvent,
    eventCount,
    sentimentAgg,
    latestSurvey,
    campaignEventCount,
    redemptionCount,
  ] = await Promise.all([
    // Most recent loyalty event
    prisma.loyaltyEvent.findFirst({
      where: { memberId, brandId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    // Event count in last 90 days
    prisma.loyaltyEvent.count({
      where: { memberId, brandId, createdAt: { gte: ninetyDaysAgo } },
    }),
    // Average sentiment from last 90 days
    prisma.surveyResponse.aggregate({
      where: { memberId, brandId, completedAt: { gte: ninetyDaysAgo } },
      _avg: { sentiment: true },
    }),
    // Latest survey response with a score
    prisma.surveyResponse.findFirst({
      where: { memberId, brandId, score: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { score: true },
    }),
    // Campaign events in last 90 days
    prisma.campaignEvent.count({
      where: { memberId, brandId, executedAt: { gte: ninetyDaysAgo } },
    }),
    // Redemptions in last 90 days
    prisma.redemption.count({
      where: { memberId, brandId, createdAt: { gte: ninetyDaysAgo } },
    }),
  ])

  const daysSinceLastActivity = lastEvent
    ? Math.floor((Date.now() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return computeHealthScore(
    {
      daysSinceLastActivity,
      loyaltyEventCount90d: eventCount,
      avgSentiment90d: sentimentAgg._avg.sentiment,
      latestNpsScore: latestSurvey?.score ?? null,
      engagementCount90d: campaignEventCount + redemptionCount,
    },
    weights,
  )
}

// ---------------------------------------------------------------------------
// Batch health score computation (inline processor)
// ---------------------------------------------------------------------------

/**
 * Computes health scores for all active members of a brand (or a single member).
 * Used by both the inline queue fallback and the BullMQ worker processor.
 */
export async function processHealthScoreComputation(
  payload: HealthScoreComputationPayload,
): Promise<{ membersProcessed: number; avgScore: number; distribution: Record<string, number> }> {
  const { brandId, memberId } = payload
  const startTime = Date.now()

  log.info({ brandId, memberId, mode: memberId ? 'single' : 'batch' }, 'health-score.computation.start')

  // Build where clause
  const where: Record<string, unknown> = {
    brandId,
    status: { not: 'ERASED' },
    erased: false,
    deletedAt: null,
  }
  if (memberId) {
    where.id = memberId
  }

  const members = await prisma.member.findMany({
    where,
    select: { id: true },
  })

  let totalScore = 0
  let processed = 0
  const distribution: Record<string, number> = {
    critical: 0, // 0-20
    poor: 0,     // 21-40
    fair: 0,     // 41-60
    good: 0,     // 61-80
    excellent: 0, // 81-100
  }

  for (const member of members) {
    try {
      const breakdown = await computeHealthScoreForMember(member.id, brandId)
      await prisma.member.update({
        where: { id: member.id },
        data: {
          healthScore: breakdown.overall,
          healthScoreUpdatedAt: new Date(),
        },
      })

      totalScore += breakdown.overall
      processed++

      if (breakdown.overall <= 20) distribution.critical++
      else if (breakdown.overall <= 40) distribution.poor++
      else if (breakdown.overall <= 60) distribution.fair++
      else if (breakdown.overall <= 80) distribution.good++
      else distribution.excellent++
    } catch (err) {
      log.error({ brandId, memberId: member.id, err }, 'health-score.computation.error')
    }
  }

  const durationMs = Date.now() - startTime
  const avgScore = processed > 0 ? Math.round(totalScore / processed) : 0

  log.info(
    { brandId, membersProcessed: processed, avgScore, distribution, durationMs },
    'health-score.computation.complete',
  )

  return { membersProcessed: processed, avgScore, distribution }
}
