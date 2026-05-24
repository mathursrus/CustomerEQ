import type { FastifyPluginAsync } from 'fastify'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Given an array of NPS responses (score 0-10), returns the NPS score.
 * NPS = (promoters% - detractors%) * 100, rounded to nearest integer.
 */
function computeNpsScore(responses: { score: number }[]): number | null {
  const npsResponses = responses.filter((r) => r.score !== null && r.score !== undefined)
  if (npsResponses.length === 0) return null
  const promoters = npsResponses.filter((r) => r.score >= 9).length
  const detractors = npsResponses.filter((r) => r.score <= 6).length
  return Math.round(((promoters - detractors) / npsResponses.length) * 100)
}

/**
 * Groups responses by ISO week bucket (Monday-start) and computes NPS per bucket.
 * Returns last `weeks` buckets sorted oldest→newest. Buckets with no responses
 * carry the previous bucket's score (forward-fill) or null.
 */
function buildWeeklyNpsBuckets(
  responses: { score: number | null; completedAt: Date }[],
  weeks: number = 7,
): Array<{ weekStart: string; nps: number | null; count: number }> {
  const now = new Date()
  const buckets: Array<{ weekStart: string; nps: number | null; count: number }> = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7) // Monday
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekResponses = responses.filter(
      (r) => r.score !== null && r.completedAt >= weekStart && r.completedAt < weekEnd,
    ) as { score: number; completedAt: Date }[]

    buckets.push({
      weekStart: weekStart.toISOString(),
      nps: weekResponses.length > 0 ? computeNpsScore(weekResponses) : null,
      count: weekResponses.length,
    })
  }

  // Forward-fill null buckets with last known NPS
  let lastKnown: number | null = null
  for (const b of buckets) {
    if (b.nps !== null) {
      lastKnown = b.nps
    } else if (lastKnown !== null) {
      b.nps = lastKnown
    }
  }

  return buckets
}

/**
 * Formats an ExternalSignal row into the mobile reviews API shape.
 */
function formatReviewForMobile(signal: {
  id: string
  externalAuthorLabel: string | null
  rating: number | null
  body: string
  postedAt: Date | null
  providerStatus: string | null
}) {
  return {
    id: signal.id,
    author: signal.externalAuthorLabel ?? 'Anonymous',
    rating: signal.rating ?? 0,
    text: signal.body,
    date: signal.postedAt?.toISOString() ?? null,
    replied: signal.providerStatus === 'replied',
  }
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

const mobileRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/mobile/dashboard
   * Aggregate for the Home screen: 7-week NPS trend, response rate,
   * total responses, and the latest unresolved anomaly.
   */
  fastify.get('/mobile/dashboard', async (request, reply) => {
    const brandId = request.brandId
    const prisma = fastify.prisma

    const sevenWeeksAgo = new Date()
    sevenWeeksAgo.setDate(sevenWeeksAgo.getDate() - 7 * 7)

    // Fetch last 7 weeks of scored responses in parallel with all-time count + anomaly
    const [recentResponses, totalResponses, anomaly] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: {
          brandId,
          completedAt: { gte: sevenWeeksAgo },
          score: { not: null },
        },
        select: { score: true, completedAt: true },
      }),
      prisma.surveyResponse.count({ where: { brandId } }),
      prisma.feedbackAnomaly.findFirst({
        where: { brandId, resolvedAt: null },
        orderBy: { detectedAt: 'desc' },
      }),
    ])

    // Build 7-week weekly trend
    const weeklyTrend = buildWeeklyNpsBuckets(
      recentResponses as { score: number | null; completedAt: Date }[],
      7,
    )

    // Current NPS = last completed week (index 5, second-to-last), previous = index 4
    // The last bucket is the current (possibly incomplete) week; we use the
    // penultimate bucket as the "most recent completed week".
    const completedWeekBucket = weeklyTrend[weeklyTrend.length - 2] ?? null
    const previousWeekBucket = weeklyTrend[weeklyTrend.length - 3] ?? null

    const currentScore = completedWeekBucket?.nps ?? null
    const previousScore = previousWeekBucket?.nps ?? null
    const delta =
      currentScore !== null && previousScore !== null ? currentScore - previousScore : null

    // Response rate: this week's responses / total (simple proxy; no distinct member count)
    const thisWeekCount = weeklyTrend[weeklyTrend.length - 1]?.count ?? 0
    const responseRate = totalResponses > 0 ? Math.round((thisWeekCount / totalResponses) * 100) : 0

    // Resolve cluster label if anomaly has a clusterId
    let clusterLabel: string | null = null
    if (anomaly?.clusterId) {
      const cluster = await prisma.feedbackCluster.findUnique({
        where: { id: anomaly.clusterId },
        select: { label: true },
      })
      clusterLabel = cluster?.label ?? null
    }

    const activeAnomaly = anomaly
      ? {
          id: anomaly.id,
          clusterId: anomaly.clusterId ?? null,
          clusterLabel,
          summary: anomaly.summary,
          severity: anomaly.severity,
          detectedAt: anomaly.detectedAt.toISOString(),
        }
      : null

    return reply.send({
      nps: {
        currentScore,
        delta,
        weeklyTrend,
      },
      responseRate,
      totalResponses,
      activeAnomaly,
    })
  })

  /**
   * GET /v1/reviews
   * Paginated Google Business Profile reviews for the brand.
   */
  fastify.get('/reviews', async (request, reply) => {
    const brandId = request.brandId
    const prisma = fastify.prisma

    const query = request.query as { page?: string; limit?: string }
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
    const offset = (page - 1) * limit

    const where = {
      brandId,
      sourceType: 'GOOGLE_BUSINESS_PROFILE' as const,
    }

    const [signals, total] = await Promise.all([
      prisma.externalSignal.findMany({
        where,
        orderBy: { postedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          externalAuthorLabel: true,
          rating: true,
          body: true,
          postedAt: true,
          providerStatus: true,
        },
      }),
      prisma.externalSignal.count({ where }),
    ])

    const data = signals.map(formatReviewForMobile)

    // Compute overall rating and distribution across all reviews (not just this page)
    const allRatings = await prisma.externalSignal.findMany({
      where,
      select: { rating: true },
    })

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    let ratingSum = 0
    let ratingCount = 0
    for (const r of allRatings) {
      if (r.rating !== null) {
        const key = String(Math.min(5, Math.max(1, Math.round(r.rating))))
        distribution[key] = (distribution[key] ?? 0) + 1
        ratingSum += r.rating
        ratingCount++
      }
    }
    const overallRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null

    return reply.send({
      data,
      meta: {
        total,
        page,
        limit,
        hasMore: offset + data.length < total,
        overallRating,
        distribution,
      },
    })
  })

  /**
   * POST /v1/reviews/:reviewId/reply
   * Mark a review as replied and append the reply text to statusHistory.
   */
  fastify.post('/reviews/:reviewId/reply', async (request, reply) => {
    const brandId = request.brandId
    const prisma = fastify.prisma

    const { reviewId } = request.params as { reviewId: string }
    const body = request.body as { text?: string }

    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return reply.status(400).send({ error: 'text is required' })
    }

    // Validate ownership — signal must belong to this brand
    const signal = await prisma.externalSignal.findFirst({
      where: { id: reviewId, brandId },
      select: { id: true, statusHistory: true },
    })

    if (!signal) {
      return reply.status(404).send({ error: 'Review not found' })
    }

    // Append reply entry to statusHistory JSON array
    const existingHistory = Array.isArray(signal.statusHistory) ? signal.statusHistory : []
    const newEntry = {
      action: 'replied',
      text: body.text.trim(),
      timestamp: new Date().toISOString(),
    }

    await prisma.externalSignal.update({
      where: { id: reviewId },
      data: {
        providerStatus: 'replied',
        statusHistory: [...existingHistory, newEntry],
      },
    })

    return reply.send({ success: true, id: reviewId })
  })
}

export default mobileRoutes
