import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type {
  HealthScoreComputationPayload,
  HealthScoreWeights,
} from '@customerEQ/shared'
import { DEFAULT_HEALTH_SCORE_WEIGHTS } from '@customerEQ/shared'

const logger = pino({ name: 'health-score-worker' })

// ---------------------------------------------------------------------------
// Sub-score computation (pure functions)
// ---------------------------------------------------------------------------

function computeRecencyScore(daysSinceLastActivity: number | null): number {
  if (daysSinceLastActivity === null) return 50
  if (daysSinceLastActivity <= 7) return 100
  if (daysSinceLastActivity >= 90) return 0
  return Math.round(100 * (90 - daysSinceLastActivity) / (90 - 7))
}

function computeFrequencyScore(eventCount: number): number {
  if (eventCount >= 10) return 100
  return Math.round((eventCount / 10) * 100)
}

function computeSentimentScore(avgSentiment: number | null): number {
  if (avgSentiment === null) return 50
  const clamped = Math.max(-1, Math.min(1, avgSentiment))
  return Math.round(((clamped + 1) / 2) * 100)
}

function computeNpsScore(latestScore: number | null): number {
  if (latestScore === null) return 50
  const clamped = Math.max(0, Math.min(10, latestScore))
  return Math.round((clamped / 10) * 100)
}

function computeEngagementScore(activityCount: number): number {
  if (activityCount >= 5) return 100
  return Math.round((activityCount / 5) * 100)
}

// ---------------------------------------------------------------------------
// BullMQ processor
// ---------------------------------------------------------------------------

export interface HealthScoreProcessorResult {
  membersProcessed: number
  avgScore: number
  distribution: Record<string, number>
}

export async function processHealthScore(
  job: Job<HealthScoreComputationPayload>,
): Promise<HealthScoreProcessorResult> {
  const { brandId, memberId } = job.data
  const weights: HealthScoreWeights = DEFAULT_HEALTH_SCORE_WEIGHTS
  const startTime = Date.now()

  logger.info({ brandId, memberId, mode: memberId ? 'single' : 'batch' }, 'health-score.computation.start')

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

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  let totalScore = 0
  let processed = 0
  const distribution: Record<string, number> = {
    critical: 0,
    poor: 0,
    fair: 0,
    good: 0,
    excellent: 0,
  }

  for (const member of members) {
    try {
      const [lastEvent, eventCount, sentimentAgg, latestSurvey, campaignEventCount, redemptionCount] = await Promise.all([
        prisma.loyaltyEvent.findFirst({
          where: { memberId: member.id, brandId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.loyaltyEvent.count({
          where: { memberId: member.id, brandId, createdAt: { gte: ninetyDaysAgo } },
        }),
        prisma.surveyResponse.aggregate({
          where: { memberId: member.id, brandId, completedAt: { gte: ninetyDaysAgo } },
          _avg: { sentiment: true },
        }),
        prisma.surveyResponse.findFirst({
          where: { memberId: member.id, brandId, score: { not: null } },
          orderBy: { completedAt: 'desc' },
          select: { score: true },
        }),
        prisma.campaignEvent.count({
          where: { memberId: member.id, brandId, executedAt: { gte: ninetyDaysAgo } },
        }),
        prisma.redemption.count({
          where: { memberId: member.id, brandId, createdAt: { gte: ninetyDaysAgo } },
        }),
      ])

      const daysSinceLastActivity = lastEvent
        ? Math.floor((Date.now() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      const recency = computeRecencyScore(daysSinceLastActivity)
      const frequency = computeFrequencyScore(eventCount)
      const sentiment = computeSentimentScore(sentimentAgg._avg.sentiment)
      const nps = computeNpsScore(latestSurvey?.score ?? null)
      const engagement = computeEngagementScore(campaignEventCount + redemptionCount)

      const overall = Math.round(
        recency * weights.recency +
        frequency * weights.frequency +
        sentiment * weights.sentiment +
        nps * weights.nps +
        engagement * weights.engagement
      )

      await prisma.member.update({
        where: { id: member.id },
        data: {
          healthScore: overall,
          healthScoreUpdatedAt: new Date(),
        },
      })

      totalScore += overall
      processed++

      if (overall <= 20) distribution.critical++
      else if (overall <= 40) distribution.poor++
      else if (overall <= 60) distribution.fair++
      else if (overall <= 80) distribution.good++
      else distribution.excellent++
    } catch (err) {
      logger.error({ brandId, memberId: member.id, err }, 'health-score.computation.error')
    }
  }

  const durationMs = Date.now() - startTime
  const avgScore = processed > 0 ? Math.round(totalScore / processed) : 0

  logger.info(
    { brandId, membersProcessed: processed, avgScore, distribution, durationMs },
    'health-score.computation.complete',
  )

  return { membersProcessed: processed, avgScore, distribution }
}
