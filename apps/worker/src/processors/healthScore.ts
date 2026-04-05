import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type {
  HealthScoreComputationPayload,
  HealthScoreWeights,
  NoteSentiment,
} from '@customerEQ/shared'
import {
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  NOTE_SENTIMENT_VALUES,
  computeHealthScore,
} from '@customerEQ/shared'

const logger = pino({ name: 'health-score-worker' })

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
      const [lastEvent, eventCount, sentimentAgg, latestSurvey, campaignEventCount, redemptionCount, latestNote] = await Promise.all([
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
        prisma.memberNote.findFirst({
          where: {
            memberId: member.id, brandId,
            createdAt: { gte: ninetyDaysAgo },
            sentiment: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { sentiment: true },
        }),
      ])

      const daysSinceLastActivity = lastEvent
        ? Math.floor((Date.now() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      const latestNoteSentiment90d =
        latestNote?.sentiment && (NOTE_SENTIMENT_VALUES as readonly string[]).includes(latestNote.sentiment)
          ? (latestNote.sentiment as NoteSentiment)
          : null

      const breakdown = computeHealthScore(
        {
          daysSinceLastActivity,
          loyaltyEventCount90d: eventCount,
          avgSentiment90d: sentimentAgg._avg.sentiment,
          latestNpsScore: latestSurvey?.score ?? null,
          engagementCount90d: campaignEventCount + redemptionCount,
          latestNoteSentiment90d,
        },
        weights,
      )
      const overall = breakdown.overall

      await prisma.member.update({
        where: { id: member.id },
        data: {
          healthScore: overall,
          healthScoreUpdatedAt: new Date(),
          healthScoreBreakdown: breakdown as unknown as object,
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
