import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { computeTrend } from '@customerEQ/ai'
import { enqueueFeedbackClustering } from '../queues/bullmq.js'

interface AnalyticsTotals {
  totalMembers: number
  totalPointsIssued: number
  totalPointsRedeemed: number
}

const DateRangeSchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }),
})

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
  // GET /v1/analytics/cx?startDate=...&endDate=... — CX metrics (NPS/CSAT/CES trends, sentiment)
  fastify.get('/analytics/cx', async (request, reply) => {
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

    // Get all survey responses in the date range
    const responses = await fastify.prisma.surveyResponse.findMany({
      where: {
        brandId,
        completedAt: { gte: startDate, lte: endDate },
      },
      include: {
        survey: { select: { type: true, name: true } },
      },
    })

    // Aggregate by survey type
    const npsResponses = responses.filter((r) => r.survey.type === 'NPS' && r.score !== null)
    const csatResponses = responses.filter((r) => r.survey.type === 'CSAT' && r.score !== null)
    const cesResponses = responses.filter((r) => r.survey.type === 'CES' && r.score !== null)

    // Calculate NPS score: % promoters (9-10) - % detractors (0-6)
    const npsScore = npsResponses.length > 0
      ? (() => {
          const promoters = npsResponses.filter((r) => r.score! >= 9).length
          const detractors = npsResponses.filter((r) => r.score! <= 6).length
          return Math.round(((promoters - detractors) / npsResponses.length) * 100)
        })()
      : null

    // Calculate CSAT average (1-5 scale)
    const csatAverage = csatResponses.length > 0
      ? Math.round(
          (csatResponses.reduce((sum, r) => sum + r.score!, 0) / csatResponses.length) * 100,
        ) / 100
      : null

    // Calculate CES average (1-7 scale)
    const cesAverage = cesResponses.length > 0
      ? Math.round(
          (cesResponses.reduce((sum, r) => sum + r.score!, 0) / cesResponses.length) * 100,
        ) / 100
      : null

    // Sentiment distribution
    const withSentiment = responses.filter((r) => r.sentiment !== null)
    const sentimentDistribution = {
      positive: withSentiment.filter((r) => r.sentiment! > 0.3).length,
      neutral: withSentiment.filter((r) => r.sentiment! >= -0.3 && r.sentiment! <= 0.3).length,
      negative: withSentiment.filter((r) => r.sentiment! < -0.3).length,
    }

    // Average sentiment
    const avgSentiment = withSentiment.length > 0
      ? Math.round(
          (withSentiment.reduce((sum, r) => sum + r.sentiment!, 0) / withSentiment.length) * 100,
        ) / 100
      : null

    // Top topics across all responses
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

    // Response rate per survey
    const surveys = await fastify.prisma.survey.findMany({
      where: { brandId, status: { in: ['ACTIVE', 'CLOSED'] } },
      select: { id: true, name: true, type: true, responsesCount: true },
    })

    // Fetch active clusters with trend data
    const activeClusters = await fastify.prisma.feedbackCluster.findMany({
      where: { brandId, isActive: true },
    })

    const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2)

    const clusters = await Promise.all(
      activeClusters.map(async (cluster) => {
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
          responseCount: cluster.responseCount,
          avgSentiment: cluster.avgSentiment,
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
      totalResponses: responses.length,
      nps: {
        score: npsScore,
        responses: npsResponses.length,
        promoters: npsResponses.filter((r) => r.score! >= 9).length,
        passives: npsResponses.filter((r) => r.score! >= 7 && r.score! <= 8).length,
        detractors: npsResponses.filter((r) => r.score! <= 6).length,
      },
      csat: {
        average: csatAverage,
        responses: csatResponses.length,
      },
      ces: {
        average: cesAverage,
        responses: cesResponses.length,
      },
      sentiment: {
        average: avgSentiment,
        distribution: sentimentDistribution,
        totalAnalyzed: withSentiment.length,
      },
      topTopics,
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
          responseCount: cluster.responseCount,
          avgSentiment: cluster.avgSentiment,
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

    return reply.status(200).send({
      clusterId: cluster.id,
      label: cluster.label,
      description: cluster.description,
      keywords: cluster.keywords,
      responseCount: cluster.responseCount,
      avgSentiment: cluster.avgSentiment,
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
          const promoters = npsResponses.filter((r) => r.score! >= 9).length
          const detractors = npsResponses.filter((r) => r.score! <= 6).length
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
          (r) => r.sentiment !== null && r.sentiment < -0.3,
        ).length,
        campaignsTriggered: campaignPerformance._count,
      },
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    })
  })
}

export default analyticsRoutes
