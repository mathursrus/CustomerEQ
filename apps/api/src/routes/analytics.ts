import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

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
          COALESCE(SUM(le.points_earned) FILTER (WHERE le.points_earned > 0), 0)::int AS "totalPointsIssued",
          COALESCE(SUM(ABS(le.points_earned)) FILTER (WHERE le.points_earned < 0), 0)::int AS "totalPointsRedeemed"
        FROM loyalty_events le
        JOIN members m ON le.member_id = m.id
        WHERE le.brand_id = ${brandId}
          AND le.created_at BETWEEN ${startDate} AND ${endDate}
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
}

export default analyticsRoutes
