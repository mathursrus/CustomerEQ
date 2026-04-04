import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type {
  HealthScoreWeights,
  HealthScoreBreakdown,
  HealthScoreComputationPayload,
} from '@customerEQ/shared'
import {
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
} from '@customerEQ/shared'
// Re-export for existing consumers (tests, routes)
export {
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
}
export type { HealthScoreInputs } from '@customerEQ/shared'

const log = pino({ name: 'health-score' })

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
