import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { computeTrend, processSentimentForResponse } from '@customerEQ/ai'
import { SENTIMENT, NPS, ExternalSignalsQuerySchema } from '@customerEQ/shared'
import { enqueueFeedbackClustering } from '../queues/bullmq.js'
import { extractOpenEndedText } from '../utils/survey.js'

interface AnalyticsTotals {
  totalMembers: number
  totalPointsIssued: number
  totalPointsRedeemed: number
}

const DateRangeSchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }),
})

const CxQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }),
  surveyId: z.string().optional(),
})

// ── Reach estimate constants (Issue #79) ─────────────────────────────────────

const REACH_ESTIMATE_WINDOW_DAYS = 30
const REACH_ESTIMATE_HISTORY_THRESHOLD_DAYS = 7

// Keys that map to scheduled cadence (no event to count → active member fallback)
const SCHEDULED_TRIGGER_KEYS = new Set(['quarterly_pulse', 'monthly_csat', 'annual_program'])

// Maps survey triggerKey → LoyaltyEvent.eventType for reach-estimate query
const TRIGGER_EVENT_MAP: Record<string, string> = {
  tier_upgrade: 'tier.upgraded',
  enrollment: 'member.enrolled',
  first_redemption: 'member.first_redemption',
  '5th_purchase': 'purchase',
  anniversary: 'member.anniversary',
  inactive_30d: 'member.inactive',
  after_support: 'cx.ticket_resolved',
  nps_drop: 'cx.nps_response',
}

/* ── Shared helper: compute CX stats from a set of responses ── */

interface ResponseRow {
  id: string
  score: number | null
  sentiment: number | null
  topics: string[]
  survey: { type: string; name: string }
  surveyId: string
  clusterId: string | null
}

function computeCxStats(responses: ResponseRow[]) {
  const npsResponses = responses.filter((r) => r.survey.type === 'NPS' && r.score !== null)
  const csatResponses = responses.filter((r) => r.survey.type === 'CSAT' && r.score !== null)
  const cesResponses = responses.filter((r) => r.survey.type === 'CES' && r.score !== null)

  const npsScore = npsResponses.length > 0
    ? (() => {
        const promoters = npsResponses.filter((r) => NPS.isPromoter(r.score!)).length
        const detractors = npsResponses.filter((r) => NPS.isDetractor(r.score!)).length
        return Math.round(((promoters - detractors) / npsResponses.length) * 100)
      })()
    : null

  const csatAverage = csatResponses.length > 0
    ? Math.round((csatResponses.reduce((sum, r) => sum + r.score!, 0) / csatResponses.length) * 100) / 100
    : null

  const cesAverage = cesResponses.length > 0
    ? Math.round((cesResponses.reduce((sum, r) => sum + r.score!, 0) / cesResponses.length) * 100) / 100
    : null

  const withSentiment = responses.filter((r) => r.sentiment !== null)
  const sentimentDistribution = {
    positive: withSentiment.filter((r) => r.sentiment! > SENTIMENT.POSITIVE_THRESHOLD).length,
    neutral: withSentiment.filter((r) => r.sentiment! >= SENTIMENT.NEGATIVE_THRESHOLD && r.sentiment! <= SENTIMENT.POSITIVE_THRESHOLD).length,
    negative: withSentiment.filter((r) => r.sentiment! < SENTIMENT.NEGATIVE_THRESHOLD).length,
  }

  const avgSentiment = withSentiment.length > 0
    ? Math.round((withSentiment.reduce((sum, r) => sum + r.sentiment!, 0) / withSentiment.length) * 100) / 100
    : null

  const topicCounts = new Map<string, number>()
  for (const r of responses) {
    for (const topic of r.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    }
  }
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }))

  return {
    totalResponses: responses.length,
    nps: {
      score: npsScore,
      responses: npsResponses.length,
      promoters: npsResponses.filter((r) => NPS.isPromoter(r.score!)).length,
      passives: npsResponses.filter((r) => !NPS.isPromoter(r.score!) && !NPS.isDetractor(r.score!)).length,
      detractors: npsResponses.filter((r) => NPS.isDetractor(r.score!)).length,
    },
    csat: { average: csatAverage, responses: csatResponses.length },
    ces: { average: cesAverage, responses: cesResponses.length },
    sentiment: {
      average: avgSentiment,
      distribution: sentimentDistribution,
      totalAnalyzed: withSentiment.length,
    },
    topTopics,
  }
}

function buildExternalSignalWhere(
  brandId: string,
  query: ReturnType<typeof ExternalSignalsQuerySchema.parse>,
): Prisma.ExternalSignalWhereInput {
  const where: Prisma.ExternalSignalWhereInput = { brandId }

  if (query.sourceType) where.sourceType = query.sourceType
  if (query.matchStatus) where.matchStatus = query.matchStatus
  if (query.resolved === 'true') where.memberId = { not: null }
  if (query.resolved === 'false') where.memberId = null
  if (query.ratingMin !== undefined || query.ratingMax !== undefined) {
    where.rating = {
      gte: query.ratingMin,
      lte: query.ratingMax,
    }
  }
  if (query.sentimentMin !== undefined || query.sentimentMax !== undefined) {
    where.sentiment = {
      gte: query.sentimentMin,
      lte: query.sentimentMax,
    }
  }
  if (query.subjectKey) where.subjectKey = query.subjectKey
  if (query.search) {
    where.OR = [
      { body: { contains: query.search, mode: 'insensitive' } },
      { summary: { contains: query.search, mode: 'insensitive' } },
      { externalAuthorLabel: { contains: query.search, mode: 'insensitive' } },
      { subjectLabel: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  if (query.startDate || query.endDate) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined
    const endDate = query.endDate ? new Date(query.endDate) : undefined
    const dateClause: Prisma.ExternalSignalWhereInput = {
      OR: [
        { postedAt: { gte: startDate, lte: endDate } },
        { postedAt: null, ingestedAt: { gte: startDate, lte: endDate } },
      ],
    }
    const existingAnd = where.AND
      ? (Array.isArray(where.AND) ? where.AND : [where.AND])
      : []
    where.AND = [...existingAnd, dateClause]
  }

  return where
}

function computeExternalSignalStats(
  signals: Array<{ sourceType: string; sentiment: number | null; memberId: string | null }>,
) {
  const bySourceType = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.sourceType] = (acc[signal.sourceType] ?? 0) + 1
    return acc
  }, {})

  const withSentiment = signals.filter((signal) => signal.sentiment !== null)

  return {
    total: signals.length,
    matched: signals.filter((signal) => signal.memberId !== null).length,
    unmatched: signals.filter((signal) => signal.memberId === null).length,
    bySourceType,
    sentimentDistribution: {
      positive: withSentiment.filter((signal) => signal.sentiment! > SENTIMENT.POSITIVE_THRESHOLD).length,
      neutral: withSentiment.filter((signal) => signal.sentiment! >= SENTIMENT.NEGATIVE_THRESHOLD && signal.sentiment! <= SENTIMENT.POSITIVE_THRESHOLD).length,
      negative: withSentiment.filter((signal) => signal.sentiment! < SENTIMENT.NEGATIVE_THRESHOLD).length,
    },
  }
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/analytics/overview?startDate=...&endDate=...
  fastify.get('/analytics/overview', async (request, reply) => {
    const parse = DateRangeSchema.safeParse(request.query)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const { startDate: startDateStr, endDate: endDateStr } = parse.data
    const brandId = request.brandId
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    const [totalsResult, topRewardsResult, program] = await Promise.all([
      fastify.prisma.$queryRaw<AnalyticsTotals[]>`
        SELECT
          COUNT(DISTINCT m.id)::int AS "totalMembers",
          COALESCE(SUM(le."pointsEarned") FILTER (WHERE le."pointsEarned" > 0), 0)::int AS "totalPointsIssued",
          COALESCE(SUM(ABS(le."pointsEarned")) FILTER (WHERE le."pointsEarned" < 0), 0)::int AS "totalPointsRedeemed"
        FROM loyalty_events le
        JOIN members m ON le."memberId" = m.id
        WHERE le."brandId" = ${brandId}
          AND le."createdAt" BETWEEN ${startDate} AND ${endDate}
      `,
      fastify.prisma.redemption.groupBy({
        by: ['rewardId'],
        where: {
          brandId,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { rewardId: true },
        orderBy: { _count: { rewardId: 'desc' } },
        take: 5,
      }),
      fastify.prisma.program.findFirst({
        where: { brandId, status: 'ACTIVE' },
        select: { pointToCurrencyRatio: true },
      }),
    ])

    const totals: AnalyticsTotals = totalsResult[0] ?? {
      totalMembers: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
    }

    const { totalPointsIssued, totalPointsRedeemed, totalMembers } = totals

    const redemptionRate =
      totalPointsIssued > 0
        ? Math.round((totalPointsRedeemed / totalPointsIssued) * 100 * 100) / 100
        : 0

    const pointToCurrencyRatio = program?.pointToCurrencyRatio ?? 0.01
    const roi =
      totalPointsRedeemed > 0 && totalPointsIssued > 0
        ? (totalPointsRedeemed / totalPointsIssued) * 100
        : 0

    // Resolve reward names for top rewards
    const topRewardIds = topRewardsResult.map((r: { rewardId: string; _count: { rewardId: number } }) => r.rewardId)
    const rewardDetails = await fastify.prisma.reward.findMany({
      where: { id: { in: topRewardIds }, brandId },
      select: { id: true, name: true },
    })
    const rewardMap = new Map(rewardDetails.map((r: { id: string; name: string }) => [r.id, r.name]))

    const topRewards = topRewardsResult.map((r: { rewardId: string; _count: { rewardId: number } }) => ({
      rewardId: r.rewardId,
      rewardName: rewardMap.get(r.rewardId) ?? r.rewardId,
      redemptionCount: r._count.rewardId,
    }))

    return reply.status(200).send({
      totalMembers,
      totalPointsIssued,
      totalPointsRedeemed,
      redemptionRate,
      roi: Math.round(roi * 100) / 100,
      pointToCurrencyRatio,
      topRewards,
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    })
  })

  // GET /v1/analytics/campaigns — per-campaign performance
  fastify.get('/analytics/campaigns', async (request, reply) => {
    const brandId = request.brandId

    const campaigns = await fastify.prisma.campaign.findMany({
      where: { brandId },
      include: {
        campaignEvents: {
          select: {
            id: true,
            status: true,
            executedAt: true,
            latencyMs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      campaigns.map(async (campaign: typeof campaigns[number]) => {
        // Sum points awarded from loyalty events linked to this campaign
        const pointsResult = await fastify.prisma.loyaltyEvent.aggregate({
          where: {
            brandId,
            campaignId: campaign.id,
            pointsEarned: { gt: 0 },
          },
          _sum: { pointsEarned: true },
        })

        const eventsTriggered = campaign.campaignEvents.length
        const actionsExecuted = campaign.campaignEvents.filter(
          (e: { executedAt: Date | null }) => e.executedAt !== null,
        ).length
        const pointsAwarded = pointsResult._sum.pointsEarned ?? 0

        const avgLatencyMs =
          eventsTriggered > 0
            ? campaign.campaignEvents
                .map((e: { latencyMs: number | null }) => e.latencyMs ?? 0)
                .reduce((sum: number, ms: number) => sum + ms, 0) / eventsTriggered
            : null

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          triggerType: campaign.triggerType,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          budgetCap: campaign.budgetCap,
          budgetSpent: campaign.budgetSpent,
          eventsTriggered,
          actionsExecuted,
          pointsAwarded,
          avgLatencyMs: avgLatencyMs !== null ? Math.round(avgLatencyMs) : null,
        }
      }),
    )

    return reply.status(200).send(result)
  })
  // GET /v1/analytics/cx?startDate=...&endDate=...&surveyId=... — CX metrics with optional per-survey filter
  fastify.get('/analytics/cx', async (request, reply) => {
    const parse = CxQuerySchema.safeParse(request.query)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const { startDate: startDateStr, endDate: endDateStr, surveyId: filterSurveyId } = parse.data
    const brandId = request.brandId
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    // Build where clause — optionally scoped to a single survey
    const responseWhere: Record<string, unknown> = {
      brandId,
      completedAt: { gte: startDate, lte: endDate },
    }
    if (filterSurveyId) responseWhere.surveyId = filterSurveyId

    // Get all survey responses in the date range
    const responses = await fastify.prisma.surveyResponse.findMany({
      where: responseWhere,
      include: {
        survey: { select: { type: true, name: true } },
      },
    })
    const externalSignals = await fastify.prisma.externalSignal.findMany({
      where: buildExternalSignalWhere(brandId, {
        startDate: startDateStr,
        endDate: endDateStr,
        page: 1,
        pageSize: 1000,
      }),
      select: {
        sourceType: true,
        sentiment: true,
        memberId: true,
      },
    })

    // Aggregate stats (respects surveyId filter if present)
    const aggregate = computeCxStats(responses)
    const externalSignalStats = computeExternalSignalStats(externalSignals)

    // Per-survey breakdown — always return all surveys with stats
    const allSurveys = await fastify.prisma.survey.findMany({
      where: { brandId, status: { in: ['ACTIVE', 'STOPPED'] } },
      select: { id: true, name: true, type: true, responsesCount: true },
    })

    // Group responses by surveyId for per-survey stats
    const bySurvey = new Map<string, ResponseRow[]>()
    for (const r of responses) {
      const arr = bySurvey.get(r.surveyId) ?? []
      arr.push(r)
      bySurvey.set(r.surveyId, arr)
    }

    // Collect cluster IDs referenced by responses (for per-survey cluster breakdown)
    const responseClusterIds = new Set<string>()
    for (const r of responses) {
      if (r.clusterId) responseClusterIds.add(r.clusterId)
    }
    const clusterLabelMap = new Map<string, string>()
    if (responseClusterIds.size > 0) {
      const cls = await fastify.prisma.feedbackCluster.findMany({
        where: { id: { in: [...responseClusterIds] } },
        select: { id: true, label: true },
      })
      for (const c of cls) clusterLabelMap.set(c.id, c.label)
    }

    const surveys = allSurveys.map((s) => {
      const surveyResponses = bySurvey.get(s.id) ?? []
      const stats = computeCxStats(surveyResponses)
      // Cluster breakdown for this survey
      const clusterAgg = new Map<string, { id: string; label: string; count: number; sentimentSum: number; sentimentCount: number }>()
      for (const r of surveyResponses) {
        if (r.clusterId) {
          const label = clusterLabelMap.get(r.clusterId) ?? r.clusterId
          const existing = clusterAgg.get(r.clusterId)
          if (existing) {
            existing.count++
            if (r.sentiment !== null) { existing.sentimentSum += r.sentiment; existing.sentimentCount++ }
          } else {
            clusterAgg.set(r.clusterId, {
              id: r.clusterId,
              label,
              count: 1,
              sentimentSum: r.sentiment ?? 0,
              sentimentCount: r.sentiment !== null ? 1 : 0,
            })
          }
        }
      }
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        responsesCount: s.responsesCount,
        ...stats,
        clusters: [...clusterAgg.values()]
          .sort((a, b) => b.count - a.count)
          .map((c) => ({
            id: c.id,
            label: c.label,
            count: c.count,
            avgSentiment: c.sentimentCount > 0 ? Math.round((c.sentimentSum / c.sentimentCount) * 100) / 100 : null,
          })),
      }
    })

    // Fetch active clusters with trend data — compute live stats from responses
    // When filtering by survey, only include clusters that have responses in the filtered set
    const clusterIdsInScope = new Set(responses.map((r) => r.clusterId).filter(Boolean) as string[])
    const activeClusters = await fastify.prisma.feedbackCluster.findMany({
      where: {
        brandId,
        isActive: true,
        ...(filterSurveyId ? { id: { in: [...clusterIdsInScope] } } : {}),
      },
    })

    // Build live cluster stats from responses (not stale denormalized fields)
    const clusterResponseMap = new Map<string, ResponseRow[]>()
    for (const r of responses) {
      if (r.clusterId) {
        const arr = clusterResponseMap.get(r.clusterId) ?? []
        arr.push(r)
        clusterResponseMap.set(r.clusterId, arr)
      }
    }

    const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2)

    const clusters = await Promise.all(
      activeClusters.map(async (cluster) => {
        const clusterResponses = clusterResponseMap.get(cluster.id) ?? []
        const withSent = clusterResponses.filter((r) => r.sentiment !== null)
        const liveAvgSentiment = withSent.length > 0
          ? Math.round((withSent.reduce((sum, r) => sum + r.sentiment!, 0) / withSent.length) * 100) / 100
          : null

        const [previousSnapshots, recentSnapshots] = await Promise.all([
          fastify.prisma.clusterSnapshot.findMany({
            where: {
              clusterId: cluster.id,
              brandId,
              bucketDate: { gte: startDate, lt: midpoint },
            },
          }),
          fastify.prisma.clusterSnapshot.findMany({
            where: {
              clusterId: cluster.id,
              brandId,
              bucketDate: { gte: midpoint, lte: endDate },
            },
          }),
        ])

        const trend = computeTrend(
          recentSnapshots.map((s) => s.volume),
          previousSnapshots.map((s) => s.volume),
        )

        return {
          id: cluster.id,
          label: cluster.label,
          description: cluster.description,
          responseCount: clusterResponses.length || cluster.responseCount,
          avgSentiment: liveAvgSentiment,
          trending: trend.direction,
          changePercent: trend.changePercent,
        }
      }),
    )

    // Fetch anomalies in date range
    const anomalies = await fastify.prisma.feedbackAnomaly.findMany({
      where: {
        brandId,
        detectedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { detectedAt: 'desc' },
    })

    const anomalyClusterIds = anomalies
      .filter((a) => a.clusterId !== null)
      .map((a) => a.clusterId as string)
    const anomalyClusters = anomalyClusterIds.length > 0
      ? await fastify.prisma.feedbackCluster.findMany({
          where: { id: { in: anomalyClusterIds } },
          select: { id: true, label: true },
        })
      : []
    const anomalyClusterMap = new Map(anomalyClusters.map((c) => [c.id, c.label]))

    return reply.status(200).send({
      ...aggregate,
      externalSignals: externalSignalStats,
      surveys,
      clusters,
      anomalies: anomalies.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        summary: a.summary,
        clusterLabel: a.clusterId ? anomalyClusterMap.get(a.clusterId) ?? null : null,
        detectedAt: a.detectedAt.toISOString(),
      })),
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    })
  })

  fastify.get('/analytics/cx/external-signals', async (request, reply) => {
    const query = ExternalSignalsQuerySchema.parse(request.query)
    const where = buildExternalSignalWhere(request.brandId, query)

    const [signals, total] = await Promise.all([
      fastify.prisma.externalSignal.findMany({
        where,
        include: {
          source: { select: { id: true, name: true } },
        },
        orderBy: [{ postedAt: 'desc' }, { ingestedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.externalSignal.count({ where }),
    ])

    return reply.status(200).send({
      data: signals.map((signal) => ({
        id: signal.id,
        sourceId: signal.sourceId,
        sourceName: signal.source.name,
        sourceType: signal.sourceType,
        body: signal.body,
        summary: signal.summary,
        rating: signal.rating,
        sentiment: signal.sentiment,
        topics: signal.topics,
        canonicalUrl: signal.canonicalUrl,
        externalAuthorLabel: signal.externalAuthorLabel,
        subjectLabel: signal.subjectLabel,
        matchStatus: signal.matchStatus,
        postedAt: signal.postedAt ?? signal.ingestedAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    })
  })

  // GET /v1/analytics/cx/responses?startDate=...&endDate=...&surveyId=...&page=1&pageSize=25
  fastify.get('/analytics/cx/responses', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const brandId = request.brandId

    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = query.startDate ? new Date(query.startDate) : defaultStart
    const endDate = query.endDate ? new Date(query.endDate) : now
    const surveyId = query.surveyId
    const clusterId = query.clusterId
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))

    const where: Record<string, unknown> = {
      brandId,
      completedAt: { gte: startDate, lte: endDate },
    }
    if (surveyId) where.surveyId = surveyId
    if (clusterId) where.clusterId = clusterId

    const [responses, total] = await Promise.all([
      fastify.prisma.surveyResponse.findMany({
        where,
        select: {
          id: true,
          surveyId: true,
          memberId: true,
          answers: true,
          score: true,
          sentiment: true,
          confidence: true,
          topics: true,
          summary: true,
          clusterId: true,
          cluster: { select: { label: true } },
          channel: true,
          completedAt: true,
          survey: { select: { name: true, type: true } },
          member: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { completedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.surveyResponse.count({ where }),
    ])

    return reply.status(200).send({
      data: responses.map((r) => {
        const answers = r.answers as Record<string, unknown> | null
        const text = answers ? extractOpenEndedText(answers) : null
        return {
          id: r.id,
          surveyId: r.surveyId,
          surveyName: r.survey.name,
          surveyType: r.survey.type,
          memberName: r.member ? [r.member.firstName, r.member.lastName].filter(Boolean).join(' ') || null : null,
          memberEmail: r.member?.email ?? null,
          score: r.score,
          sentiment: r.sentiment,
          confidence: r.confidence,
          text,
          topics: r.topics,
          summary: r.summary,
          clusterLabel: r.cluster?.label ?? null,
          channel: r.channel,
          completedAt: r.completedAt.toISOString(),
        }
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })

  // GET /v1/analytics/cx/clusters?startDate=...&endDate=... — all active clusters with trend data
  fastify.get('/analytics/cx/clusters', async (request, reply) => {
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>

    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = query.startDate ? new Date(query.startDate) : defaultStart
    const endDate = query.endDate ? new Date(query.endDate) : now

    const clusters = await fastify.prisma.feedbackCluster.findMany({
      where: { brandId, isActive: true },
    })

    const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2)

    const result = await Promise.all(
      clusters.map(async (cluster) => {
        // Live stats from actual responses
        const liveStats = await fastify.prisma.surveyResponse.aggregate({
          where: { brandId, clusterId: cluster.id, completedAt: { gte: startDate, lte: endDate } },
          _count: true,
          _avg: { sentiment: true },
        })

        const [previousSnapshots, recentSnapshots, allSnapshots] = await Promise.all([
          fastify.prisma.clusterSnapshot.findMany({
            where: {
              clusterId: cluster.id,
              brandId,
              bucketDate: { gte: startDate, lt: midpoint },
            },
          }),
          fastify.prisma.clusterSnapshot.findMany({
            where: {
              clusterId: cluster.id,
              brandId,
              bucketDate: { gte: midpoint, lte: endDate },
            },
          }),
          fastify.prisma.clusterSnapshot.findMany({
            where: {
              clusterId: cluster.id,
              brandId,
              bucketDate: { gte: startDate, lte: endDate },
            },
            orderBy: { bucketDate: 'asc' },
          }),
        ])

        const trend = computeTrend(
          recentSnapshots.map((s) => s.volume),
          previousSnapshots.map((s) => s.volume),
        )

        return {
          id: cluster.id,
          label: cluster.label,
          description: cluster.description,
          keywords: cluster.keywords,
          responseCount: liveStats._count || cluster.responseCount,
          avgSentiment: liveStats._avg.sentiment != null ? Math.round(liveStats._avg.sentiment * 100) / 100 : null,
          trending: trend.direction,
          changePercent: trend.changePercent,
          snapshots: allSnapshots.map((s) => ({
            date: s.bucketDate.toISOString(),
            volume: s.volume,
            avgSentiment: s.avgSentiment,
            isAnomaly: s.isAnomaly,
          })),
        }
      }),
    )

    return reply.status(200).send(result)
  })

  // GET /v1/analytics/cx/clusters/:id/trend — time-series data for a specific cluster
  fastify.get('/analytics/cx/clusters/:id/trend', async (request, reply) => {
    const brandId = request.brandId
    const { id: clusterId } = request.params as { id: string }
    const query = request.query as Record<string, string | undefined>

    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = query.startDate ? new Date(query.startDate) : defaultStart
    const endDate = query.endDate ? new Date(query.endDate) : now

    const cluster = await fastify.prisma.feedbackCluster.findFirst({
      where: { id: clusterId, brandId },
    })

    if (!cluster) {
      return reply.status(404).send({ error: 'Cluster not found' })
    }

    const snapshots = await fastify.prisma.clusterSnapshot.findMany({
      where: {
        clusterId,
        brandId,
        bucketDate: { gte: startDate, lte: endDate },
      },
      orderBy: { bucketDate: 'asc' },
    })

    // Live stats from actual responses
    const liveStats = await fastify.prisma.surveyResponse.aggregate({
      where: { brandId, clusterId, completedAt: { gte: startDate, lte: endDate } },
      _count: true,
      _avg: { sentiment: true },
    })

    return reply.status(200).send({
      clusterId: cluster.id,
      label: cluster.label,
      description: cluster.description,
      keywords: cluster.keywords,
      responseCount: liveStats._count || cluster.responseCount,
      avgSentiment: liveStats._avg.sentiment != null ? Math.round(liveStats._avg.sentiment * 100) / 100 : null,
      trend: snapshots.map((s) => ({
        date: s.bucketDate.toISOString(),
        volume: s.volume,
        avgSentiment: s.avgSentiment,
        isAnomaly: s.isAnomaly,
      })),
    })
  })

  // GET /v1/analytics/cx/anomalies?startDate=...&endDate=...&severity=... — active anomalies
  fastify.get('/analytics/cx/anomalies', async (request, reply) => {
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>

    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = query.startDate ? new Date(query.startDate) : defaultStart
    const endDate = query.endDate ? new Date(query.endDate) : now
    const severity = query.severity

    const where: Record<string, unknown> = {
      brandId,
      detectedAt: { gte: startDate, lte: endDate },
    }
    if (severity) {
      where.severity = severity
    }

    const anomalies = await fastify.prisma.feedbackAnomaly.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
    })

    // Resolve cluster labels
    const clusterIds = anomalies
      .filter((a) => a.clusterId !== null)
      .map((a) => a.clusterId as string)
    const clusters = clusterIds.length > 0
      ? await fastify.prisma.feedbackCluster.findMany({
          where: { id: { in: clusterIds } },
          select: { id: true, label: true },
        })
      : []
    const clusterMap = new Map(clusters.map((c) => [c.id, c.label]))

    return reply.status(200).send(
      anomalies.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        summary: a.summary,
        clusterLabel: a.clusterId ? clusterMap.get(a.clusterId) ?? null : null,
        detectedAt: a.detectedAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        metadata: a.metadata,
      })),
    )
  })

  // POST /v1/analytics/cx/clustering/trigger — enqueue a feedback clustering job
  fastify.post('/analytics/cx/clustering/trigger', async (request, reply) => {
    const brandId = request.brandId

    const job = await enqueueFeedbackClustering({
      brandId,
      triggeredBy: (request as unknown as { userId?: string }).userId ?? 'system',
    })

    return reply.status(202).send({
      message: 'Clustering job queued',
      jobId: job.id,
    })
  })

  // GET /v1/analytics/unified?startDate=...&endDate=... — combined CX + Loyalty in one response
  fastify.get('/analytics/unified', async (request, reply) => {
    const parse = DateRangeSchema.safeParse(request.query)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const { startDate: startDateStr, endDate: endDateStr } = parse.data
    const brandId = request.brandId
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    // Run loyalty and CX queries in parallel
    const [totalsResult, program, responses, campaignPerformance] = await Promise.all([
      // Loyalty totals
      fastify.prisma.$queryRaw<AnalyticsTotals[]>`
        SELECT
          COUNT(DISTINCT m.id)::int AS "totalMembers",
          COALESCE(SUM(le."pointsEarned") FILTER (WHERE le."pointsEarned" > 0), 0)::int AS "totalPointsIssued",
          COALESCE(SUM(ABS(le."pointsEarned")) FILTER (WHERE le."pointsEarned" < 0), 0)::int AS "totalPointsRedeemed"
        FROM loyalty_events le
        JOIN members m ON le."memberId" = m.id
        WHERE le."brandId" = ${brandId}
          AND le."createdAt" BETWEEN ${startDate} AND ${endDate}
      `,
      fastify.prisma.program.findFirst({
        where: { brandId, status: 'ACTIVE' },
        select: { pointToCurrencyRatio: true },
      }),
      // CX responses
      fastify.prisma.surveyResponse.findMany({
        where: {
          brandId,
          completedAt: { gte: startDate, lte: endDate },
        },
        include: { survey: { select: { type: true } } },
      }),
      // Campaign trigger performance (CX-driven campaigns)
      fastify.prisma.campaignEvent.aggregate({
        where: {
          brandId,
          triggeredAt: { gte: startDate, lte: endDate },
        },
        _count: true,
        _avg: { latencyMs: true },
      }),
    ])

    const totals: AnalyticsTotals = totalsResult[0] ?? {
      totalMembers: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
    }

    // NPS calculation
    const npsResponses = responses.filter((r) => r.survey.type === 'NPS' && r.score !== null)
    const npsScore = npsResponses.length > 0
      ? (() => {
          const promoters = npsResponses.filter((r) => NPS.isPromoter(r.score!)).length
          const detractors = npsResponses.filter((r) => NPS.isDetractor(r.score!)).length
          return Math.round(((promoters - detractors) / npsResponses.length) * 100)
        })()
      : null

    // Sentiment average
    const withSentiment = responses.filter((r) => r.sentiment !== null)
    const avgSentiment = withSentiment.length > 0
      ? Math.round(
          (withSentiment.reduce((sum, r) => sum + r.sentiment!, 0) / withSentiment.length) * 100,
        ) / 100
      : null

    const redemptionRate = totals.totalPointsIssued > 0
      ? Math.round((totals.totalPointsRedeemed / totals.totalPointsIssued) * 100 * 100) / 100
      : 0

    return reply.status(200).send({
      loyalty: {
        totalMembers: totals.totalMembers,
        totalPointsIssued: totals.totalPointsIssued,
        totalPointsRedeemed: totals.totalPointsRedeemed,
        redemptionRate,
        pointToCurrencyRatio: program?.pointToCurrencyRatio ?? 0.01,
      },
      cx: {
        totalSurveyResponses: responses.length,
        npsScore,
        npsResponses: npsResponses.length,
        avgSentiment,
        sentimentAnalyzed: withSentiment.length,
      },
      campaigns: {
        triggersExecuted: campaignPerformance._count,
        avgLatencyMs: campaignPerformance._avg.latencyMs
          ? Math.round(campaignPerformance._avg.latencyMs)
          : null,
      },
      // The key metric: what % of negative CX feedback was acted on
      feedbackToAction: {
        negativeFeedbackCount: responses.filter(
          (r) => r.sentiment !== null && r.sentiment < SENTIMENT.NEGATIVE_THRESHOLD,
        ).length,
        campaignsTriggered: campaignPerformance._count,
      },
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    })
  })
  // POST /v1/analytics/cx/backfill-sentiment — backfill sentiment on responses with null sentiment
  fastify.post('/analytics/cx/backfill-sentiment', async (request, reply) => {
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>
    const limit = Math.min(Number(query.limit) || 100, 500)
    const force = query.force === 'true'

    // Find responses — either unanalyzed only or all (force=true for re-analysis)
    const responses = await fastify.prisma.surveyResponse.findMany({
      where: { brandId, ...(force ? {} : { sentiment: null }) },
      select: {
        id: true,
        memberId: true,
        surveyId: true,
        answers: true,
        score: true,
        survey: { select: { type: true } },
      },
      take: limit,
      orderBy: { completedAt: 'desc' },
    })

    let processed = 0
    let skipped = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const r of responses) {
      const answers = r.answers as Record<string, unknown> | null
      const text = answers ? extractOpenEndedText(answers) : null
      if (!text) {
        skipped++
        continue
      }

      if (!r.memberId) { skipped++; continue }
      const eventType = `cx.${r.survey.type.toLowerCase()}_response`
      try {
        await processSentimentForResponse(
          {
            surveyResponseId: r.id,
            brandId,
            memberId: r.memberId,
            text,
            eventType,
            score: r.score ?? undefined,
          },
          fastify.prisma,
        )
        processed++
      } catch (err) {
        errors.push({ id: r.id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    const remaining = await fastify.prisma.surveyResponse.count({
      where: { brandId, sentiment: null },
    })

    return reply.status(200).send({
      message: `Backfill complete: ${processed} processed, ${skipped} skipped (no text), ${errors.length} errors`,
      processed,
      skipped,
      errors: errors.slice(0, 10),
      remaining,
    })
  })

  // GET /v1/analytics/reach-estimate?triggerKey=...&programId=... — reach estimate for survey trigger wizard (Issue #79)
  // Graceful-degradation contract: always returns 200 (never 5xx). Returns estimatedCount=null + reason on failure.
  fastify.get('/analytics/reach-estimate', async (request, reply) => {
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>
    const { triggerKey, programId } = query

    if (!triggerKey) {
      return reply.status(400).send({ error: 'triggerKey is required' })
    }
    if (!programId) {
      return reply.status(400).send({ error: 'programId is required' })
    }

    // Verify program belongs to this brand
    const program = await fastify.prisma.program.findFirst({
      where: { id: programId, brandId, deletedAt: null },
      select: { id: true },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    const windowStart = new Date(Date.now() - REACH_ESTIMATE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const historyThreshold = new Date(Date.now() - REACH_ESTIMATE_HISTORY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    // Scheduled triggers have no event to count — fall back to active member count
    if (SCHEDULED_TRIGGER_KEYS.has(triggerKey)) {
      const activeCount = await fastify.prisma.member.count({
        where: { brandId, status: 'ACTIVE', deletedAt: null },
      })
      const channels = {
        email: Math.round(activeCount * 0.85),
        inApp: Math.round(activeCount * 0.70),
        sms: Math.round(activeCount * 0.25),
      }
      return reply.status(200).send({ estimatedCount: activeCount, channels, windowDays: REACH_ESTIMATE_WINDOW_DAYS })
    }

    const eventType = TRIGGER_EVENT_MAP[triggerKey]
    if (!eventType) {
      // Unknown trigger key — return null with reason rather than failing
      return reply.status(200).send({ estimatedCount: null, reason: 'unknown_trigger_key', channels: null, windowDays: REACH_ESTIMATE_WINDOW_DAYS })
    }

    // Check if we have at least HISTORY_THRESHOLD_DAYS of history
    const oldestEvent = await fastify.prisma.loyaltyEvent.findFirst({
      where: { brandId, eventType },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })

    if (!oldestEvent || oldestEvent.createdAt > historyThreshold) {
      return reply.status(200).send({ estimatedCount: null, reason: 'insufficient_history', channels: null, windowDays: REACH_ESTIMATE_WINDOW_DAYS })
    }

    // Count distinct members who triggered this event in the past 30 days
    type CountRow = { count: number }
    const rows = await fastify.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT le."memberId")::int AS count
      FROM loyalty_events le
      WHERE le."brandId" = ${brandId}
        AND le."eventType" = ${eventType}
        AND le."createdAt" >= ${windowStart}
    `
    const estimatedCount = rows[0]?.count ?? 0

    // Channel breakdown based on member opt-ins for those members
    type ChannelRow = { email: number; inApp: number; sms: number }
    const channelRows = await fastify.prisma.$queryRaw<ChannelRow[]>`
      SELECT
        COUNT(DISTINCT CASE WHEN m."emailOptIn" = true THEN m.id END)::int AS email,
        COUNT(DISTINCT m.id)::int AS "inApp",
        COUNT(DISTINCT CASE WHEN m."smsOptIn" = true THEN m.id END)::int AS sms
      FROM loyalty_events le
      JOIN members m ON le."memberId" = m.id
      WHERE le."brandId" = ${brandId}
        AND le."eventType" = ${eventType}
        AND le."createdAt" >= ${windowStart}
        AND m."deletedAt" IS NULL
    `
    const channels = {
      email: channelRows[0]?.email ?? 0,
      inApp: channelRows[0]?.inApp ?? estimatedCount,
      sms: channelRows[0]?.sms ?? 0,
    }

    return reply.status(200).send({ estimatedCount, channels, windowDays: REACH_ESTIMATE_WINDOW_DAYS })
  })

  // POST /v1/analytics/cx/backfill-snapshots — generate historical daily cluster snapshots for demo
  // Distributes existing responses across the past N days to create realistic trend data
  fastify.post('/analytics/cx/backfill-snapshots', async (request, reply) => {
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>
    const days = Math.min(Number(query.days) || 30, 60)

    const clusters = await fastify.prisma.feedbackCluster.findMany({
      where: { brandId, isActive: true },
      select: { id: true, label: true },
    })

    if (clusters.length === 0) {
      return reply.status(200).send({ message: 'No clusters found', snapshotsCreated: 0 })
    }

    // For each cluster, get all responses and distribute them across days
    let snapshotsCreated = 0
    for (const cluster of clusters) {
      const responses = await fastify.prisma.surveyResponse.findMany({
        where: { brandId, clusterId: cluster.id },
        select: { sentiment: true },
        orderBy: { completedAt: 'asc' },
      })

      if (responses.length === 0) continue

      // Distribute responses across days with slight randomness
      const responsesPerDay = Math.max(1, Math.floor(responses.length / days))
      let idx = 0

      for (let d = days - 1; d >= 0; d--) {
        const bucketDate = new Date()
        bucketDate.setDate(bucketDate.getDate() - d)
        bucketDate.setHours(0, 0, 0, 0)

        // Take a slice of responses for this day (with some variance)
        const variance = Math.floor(Math.random() * responsesPerDay * 0.4) - Math.floor(responsesPerDay * 0.2)
        const count = Math.max(1, Math.min(responsesPerDay + variance, responses.length - idx))
        const dayResponses = responses.slice(idx, idx + count)
        idx = Math.min(idx + count, responses.length)

        const sentiments = dayResponses.filter((r) => r.sentiment !== null).map((r) => r.sentiment!)
        const avgSentiment = sentiments.length > 0
          ? Math.round((sentiments.reduce((s, v) => s + v, 0) / sentiments.length) * 100) / 100
          : null

        await fastify.prisma.clusterSnapshot.upsert({
          where: { clusterId_bucketDate: { clusterId: cluster.id, bucketDate } },
          create: {
            clusterId: cluster.id,
            brandId,
            bucketDate,
            volume: dayResponses.length,
            avgSentiment,
          },
          update: {
            volume: dayResponses.length,
            avgSentiment,
          },
        })
        snapshotsCreated++
      }
    }

    return reply.status(200).send({
      message: `Created ${snapshotsCreated} snapshots across ${days} days for ${clusters.length} clusters`,
      snapshotsCreated,
      clusters: clusters.length,
      days,
    })
  })

  // GET /v1/analytics/program-health — unified CX+loyalty dashboard snapshot
  // CX window: last 30 days, Loyalty window: last 7 days (fixed, no query params)
  fastify.get('/analytics/program-health', async (request, reply) => {
    const brandId = request.brandId
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const warnings: string[] = []

    // ── CX Health query ────────────────────────────────────────────────────
    type CxHealthRow = {
      avgNps: number | null
      activeSurveys: number
      responseRate: number
      atRiskCount: number
    }

    const cxHealthPromise = (async (): Promise<CxHealthRow | null> => {
      try {
        const [npsRows, activeSurveysCount, activeMembers, atRiskRows] = await Promise.all([
          fastify.prisma.$queryRaw<{ avgScore: number | null; total: number }[]>`
            SELECT
              AVG(sr.score)::float AS "avgScore",
              COUNT(sr.id)::int AS total
            FROM survey_responses sr
            JOIN surveys s ON sr."surveyId" = s.id
            WHERE sr."brandId" = ${brandId}
              AND s.type = 'NPS'
              AND sr."createdAt" > ${thirtyDaysAgo}
          `,
          fastify.prisma.survey.count({ where: { brandId, status: 'ACTIVE' } }),
          fastify.prisma.member.count({ where: { brandId, status: 'ACTIVE' } }),
          fastify.prisma.$queryRaw<{ atRiskCount: number }[]>`
            SELECT COUNT(DISTINCT sr."memberId")::int AS "atRiskCount"
            FROM survey_responses sr
            WHERE sr."brandId" = ${brandId}
              AND sr.score < 7
              AND sr."createdAt" > ${thirtyDaysAgo}
          `,
        ])

        const npsRow = npsRows[0]
        const totalResponses = npsRow?.total ?? 0
        const responseRate = activeMembers > 0 ? Math.round((totalResponses / activeMembers) * 100 * 100) / 100 : 0

        // Compute NPS: (promoters - detractors) / total * 100
        let avgNps: number | null = null
        if (totalResponses > 0 && npsRow?.avgScore != null) {
          const npsResponses = await fastify.prisma.surveyResponse.findMany({
            where: {
              brandId,
              survey: { type: 'NPS' },
              createdAt: { gte: thirtyDaysAgo },
              score: { not: null },
            },
            select: { score: true },
          })
          const promoters = npsResponses.filter((r: { score: number | null }) => r.score !== null && r.score >= 9).length
          const detractors = npsResponses.filter((r: { score: number | null }) => r.score !== null && r.score < 7).length
          avgNps = npsResponses.length > 0
            ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
            : null
        }

        return {
          avgNps,
          activeSurveys: activeSurveysCount,
          responseRate,
          atRiskCount: atRiskRows[0]?.atRiskCount ?? 0,
        }
      } catch (err) {
        fastify.log.warn({ err }, 'program-health: cxHealth query failed')
        warnings.push('cxHealth query failed')
        return null
      }
    })()

    // ── Loyalty Health query ───────────────────────────────────────────────
    type LoyaltyHealthRow = {
      activeMembers: number
      pointsIssuedThisWeek: number
      redemptionRate: number
      activeCampaigns: number
    }

    const loyaltyHealthPromise = (async (): Promise<LoyaltyHealthRow | null> => {
      try {
        const [activeMembers, pointsRows, redemptionCount, activeCampaigns] = await Promise.all([
          fastify.prisma.member.count({ where: { brandId, status: 'ACTIVE' } }),
          fastify.prisma.$queryRaw<{ pointsIssued: number }[]>`
            SELECT COALESCE(SUM(le."pointsEarned"), 0)::int AS "pointsIssued"
            FROM loyalty_events le
            WHERE le."brandId" = ${brandId}
              AND le."pointsEarned" > 0
              AND le."createdAt" > ${sevenDaysAgo}
          `,
          fastify.prisma.redemption.count({ where: { brandId, createdAt: { gte: thirtyDaysAgo } } }),
          fastify.prisma.campaign.count({ where: { brandId, status: 'ACTIVE' } }),
        ])

        const redemptionRate = activeMembers > 0
          ? Math.round((redemptionCount / activeMembers) * 100 * 100) / 100
          : 0

        return {
          activeMembers,
          pointsIssuedThisWeek: pointsRows[0]?.pointsIssued ?? 0,
          redemptionRate,
          activeCampaigns,
        }
      } catch (err) {
        fastify.log.warn({ err }, 'program-health: loyaltyHealth query failed')
        warnings.push('loyaltyHealth query failed')
        return null
      }
    })()

    // ── At-risk (detractors with no recent redemption) ─────────────────────
    type AtRiskRow = { atRiskNoRedemption: number }

    const atRiskPromise = (async (): Promise<AtRiskRow | null> => {
      try {
        const rows = await fastify.prisma.$queryRaw<AtRiskRow[]>`
          SELECT COUNT(DISTINCT sr."memberId")::int AS "atRiskNoRedemption"
          FROM survey_responses sr
          LEFT JOIN redemptions r ON r."memberId" = sr."memberId"
            AND r."brandId" = ${brandId}
            AND r."createdAt" > ${thirtyDaysAgo}
          WHERE sr."brandId" = ${brandId}
            AND sr.score < 7
            AND sr."createdAt" > ${thirtyDaysAgo}
            AND r.id IS NULL
        `
        return rows[0] ?? { atRiskNoRedemption: 0 }
      } catch (err) {
        fastify.log.warn({ err }, 'program-health: atRisk query failed')
        warnings.push('atRisk query failed')
        return null
      }
    })()

    // ── Run all in parallel ────────────────────────────────────────────────
    const [cxHealth, loyaltyHealth, atRiskResult] = await Promise.all([
      cxHealthPromise,
      loyaltyHealthPromise,
      atRiskPromise,
    ])

    // ── Compute insights ───────────────────────────────────────────────────
    let insights: import('@customerEQ/shared').Insight[] = []
    try {
      const { computeInsights } = await import('../utils/computeInsights.js')

      const surveyCompletersMultiplier = null // deferred: requires cross-join AVG computation
      const surveyCompletersMemberCount = 0

      insights = computeInsights({
        atRiskCount: atRiskResult?.atRiskNoRedemption ?? 0,
        activeSurveys: cxHealth?.activeSurveys ?? 0,
        responseRate: cxHealth?.responseRate ?? 100,
        surveyCompletersMultiplier,
        surveyCompletersMemberCount,
      })
    } catch (err) {
      fastify.log.warn({ err }, 'program-health: insights computation failed')
      warnings.push('insights computation failed')
    }

    const response: Record<string, unknown> = { cxHealth, loyaltyHealth, insights }
    if (warnings.length > 0) response.warnings = warnings

    return reply.status(200).send(response)
  })
}

export default analyticsRoutes
