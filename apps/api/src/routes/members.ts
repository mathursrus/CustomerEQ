import type { FastifyPluginAsync } from 'fastify'
import { verifyToken } from '@clerk/backend'
import { EnrollMemberSchema, HealthScoreFilterSchema } from '@customerEQ/shared'
import { enqueueEvent, enqueueNotification } from '../queues/bullmq.js'
import { computeHealthScoreForMember } from '../queues/healthScore.js'

const membersRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/members/enroll — public route (new member has no org JWT yet)
  // brandId is derived from programId lookup, never from request body.
  // clerkToken (optional) is verified internally to capture clerkUserId.
  fastify.post('/members/enroll', { config: { public: true } }, async (request, reply) => {
    const parse = EnrollMemberSchema.safeParse(request.body)
    if (!parse.success) {
      const consentIssue = parse.error.errors.find((e) => e.path.includes('consentGiven'))
      if (consentIssue) {
        return reply.status(422).send({
          error: 'CONSENT_REQUIRED',
          message: 'You must accept the privacy policy and terms to enroll.',
        })
      }
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data

    // Resolve clerkUserId from optional body token
    let clerkUserId: string | undefined
    if (data.clerkToken) {
      try {
        const payload = await verifyToken(data.clerkToken, {
          secretKey: process.env.CLERK_SECRET_KEY,
        })
        clerkUserId = payload.sub
      } catch {
        return reply.status(401).send({ error: 'Invalid Clerk token' })
      }
    }

    // Look up program — derives brandId (never from request body)
    const program = await fastify.prisma.program.findFirst({
      where: { id: data.programId, status: 'ACTIVE' },
      select: { id: true, brandId: true, name: true },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    const brandId = program.brandId

    // Duplicate check — return 409 per spec R3
    const existing = await fastify.prisma.member.findUnique({
      where: { brandId_email: { brandId, email: data.email } },
    })
    if (existing) {
      return reply.status(409).send({
        error: 'EMAIL_ALREADY_ENROLLED',
        message: 'This email is already enrolled in this program.',
      })
    }

    let member: Awaited<ReturnType<typeof fastify.prisma.member.create>>
    try {
      member = await fastify.prisma.member.create({
        data: {
          brandId,
          email: data.email,
          clerkUserId: clerkUserId ?? undefined,
          firstName: data.firstName ?? undefined,
          lastName: data.lastName ?? undefined,
          phone: data.phone ?? undefined,
          pointsBalance: 0,
          status: 'ACTIVE',
          consentGivenAt: new Date(data.consentGivenAt),
          consentVersion: data.consentVersion,
          emailOptIn: data.emailOptIn,
          smsOptIn: data.smsOptIn,
        },
      })
    } catch (err: unknown) {
      // Race-condition duplicate (P2002 unique constraint)
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        return reply.status(409).send({
          error: 'EMAIL_ALREADY_ENROLLED',
          message: 'This email is already enrolled in this program.',
        })
      }
      throw err
    }

    const ingestedAt = new Date().toISOString()

    // Enqueue enrollment loyalty event (non-blocking) — worker handles bonus points
    enqueueEvent({
      brandId,
      memberId: member.id,
      eventType: 'enrollment',
      payload: { programId: program.id, programName: program.name },
      idempotencyKey: `enrollment:${member.id}`,
      ingestedAt,
    }).catch((err: unknown) => {
      fastify.log.error({ err, memberId: member.id }, 'Failed to enqueue enrollment event')
    })

    // Enqueue welcome notification (non-blocking)
    enqueueNotification({
      memberId: member.id,
      brandId,
      channel: 'email',
      message: `Welcome to ${program.name}! You're now enrolled and earning points.`,
      metadata: { programName: program.name, enrollmentBonusPending: true },
    }).catch((err: unknown) => {
      fastify.log.error({ err, memberId: member.id }, 'Failed to enqueue welcome notification')
    })

    fastify.log.info({ memberId: member.id, brandId, programId: program.id }, 'member.enrolled')

    return reply.status(201).send({
      memberId: member.id,
      email: member.email,
      firstName: member.firstName ?? null,
      pointsBalance: member.pointsBalance,
      programName: program.name,
      enrollmentBonusPending: true,
    })
  })

  // GET /v1/members/me — full member profile (requires auth)
  fastify.get('/members/me', async (request, reply) => {
    const member = await fastify.prisma.member.findFirst({
      where: {
        clerkUserId: request.clerkUserId,
        brandId: request.brandId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pointsBalance: true,
        status: true,
        emailOptIn: true,
        smsOptIn: true,
        createdAt: true,
        currentTierId: true,
      },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    return reply.status(200).send({
      id: member.id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      pointsBalance: member.pointsBalance,
      tier: member.currentTierId ?? null,
      enrollmentDate: member.createdAt,
      emailOptIn: member.emailOptIn,
      smsOptIn: member.smsOptIn,
    })
  })

  // GET /v1/members/me/balance
  fastify.get('/members/me/balance', async (request, reply) => {
    const member = await fastify.prisma.member.findFirst({
      where: {
        clerkUserId: request.clerkUserId,
        brandId: request.brandId,
        deletedAt: null,
      },
      select: { id: true, pointsBalance: true },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    const recentEvents = await fastify.prisma.loyaltyEvent.findMany({
      where: { memberId: member.id, brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return reply.status(200).send({
      pointsBalance: member.pointsBalance,
      recentEvents,
    })
  })

  // GET /v1/members/:id
  fastify.get<{ Params: { id: string } }>('/members/:id', async (request, reply) => {
    const member = await fastify.prisma.member.findFirst({
      where: {
        id: request.params.id,
        brandId: request.brandId,
        deletedAt: null,
      },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    return reply.status(200).send(member)
  })

  // GET /v1/members/:id/balance
  fastify.get<{ Params: { id: string } }>(
    '/members/:id/balance',
    async (request, reply) => {
      const member = await fastify.prisma.member.findFirst({
        where: {
          id: request.params.id,
          brandId: request.brandId,
          deletedAt: null,
        },
        select: { id: true, pointsBalance: true },
      })

      if (!member) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      const recentEvents = await fastify.prisma.loyaltyEvent.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      return reply.status(200).send({
        pointsBalance: member.pointsBalance,
        recentEvents,
      })
    },
  )

  // GET /v1/members/:id/360 — Customer 360 view with health score breakdown
  fastify.get<{ Params: { id: string } }>('/members/:id/360', async (request, reply) => {
    const brandId = request.brandId

    const member = await fastify.prisma.member.findFirst({
      where: {
        id: request.params.id,
        brandId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pointsBalance: true,
        status: true,
        currentTierId: true,
        healthScore: true,
        healthScoreUpdatedAt: true,
        createdAt: true,
      },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Compute breakdown on-the-fly (always fresh)
    let healthBreakdown = null
    try {
      healthBreakdown = await computeHealthScoreForMember(member.id, brandId)
    } catch (err) {
      fastify.log.error({ err, memberId: member.id }, 'health-score.360.computation-error')
    }

    // Fetch recent activity
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [
      recentLoyaltyEvents,
      recentSurveyResponses,
      recentCampaignEvents,
      recentRedemptions,
      totalLoyaltyEvents,
      totalSurveyResponses,
      totalCampaignEvents,
      totalRedemptions,
      sentimentAgg,
      latestNpsSurvey,
      lastActivity,
    ] = await Promise.all([
      fastify.prisma.loyaltyEvent.findMany({
        where: { memberId: member.id, brandId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      fastify.prisma.surveyResponse.findMany({
        where: { memberId: member.id, brandId },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
      fastify.prisma.campaignEvent.findMany({
        where: { memberId: member.id, brandId },
        orderBy: { executedAt: 'desc' },
        take: 5,
      }),
      fastify.prisma.redemption.findMany({
        where: { memberId: member.id, brandId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      fastify.prisma.loyaltyEvent.count({
        where: { memberId: member.id, brandId },
      }),
      fastify.prisma.surveyResponse.count({
        where: { memberId: member.id, brandId },
      }),
      fastify.prisma.campaignEvent.count({
        where: { memberId: member.id, brandId },
      }),
      fastify.prisma.redemption.count({
        where: { memberId: member.id, brandId },
      }),
      fastify.prisma.surveyResponse.aggregate({
        where: { memberId: member.id, brandId, completedAt: { gte: ninetyDaysAgo } },
        _avg: { sentiment: true },
      }),
      fastify.prisma.surveyResponse.findFirst({
        where: { memberId: member.id, brandId, score: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { score: true },
      }),
      fastify.prisma.loyaltyEvent.findFirst({
        where: { memberId: member.id, brandId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const daysSinceLastActivity = lastActivity
      ? Math.floor((Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return reply.status(200).send({
      member: {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        pointsBalance: member.pointsBalance,
        status: member.status,
        currentTierId: member.currentTierId,
        healthScore: member.healthScore,
        healthScoreUpdatedAt: member.healthScoreUpdatedAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
      },
      healthBreakdown,
      recentLoyaltyEvents,
      recentSurveyResponses,
      recentCampaignEvents,
      recentRedemptions,
      stats: {
        totalLoyaltyEvents,
        totalSurveyResponses,
        totalCampaignEvents,
        totalRedemptions,
        avgSentiment: sentimentAgg._avg.sentiment,
        latestNpsScore: latestNpsSurvey?.score ?? null,
        daysSinceLastActivity,
      },
    })
  })

  // GET /v1/members — list members with optional health score filters
  fastify.get<{ Querystring: Record<string, string> }>('/members', async (request, reply) => {
    const brandId = request.brandId
    const filter = HealthScoreFilterSchema.safeParse(request.query)

    const where: Record<string, unknown> = {
      brandId,
      deletedAt: null,
    }

    if (filter.success) {
      if (filter.data.healthScoreMin !== undefined || filter.data.healthScoreMax !== undefined) {
        const healthScoreFilter: Record<string, number> = {}
        if (filter.data.healthScoreMin !== undefined) healthScoreFilter.gte = filter.data.healthScoreMin
        if (filter.data.healthScoreMax !== undefined) healthScoreFilter.lte = filter.data.healthScoreMax
        where.healthScore = healthScoreFilter
      }
    }

    const members = await fastify.prisma.member.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return reply.status(200).send({ members })
  })
}

export default membersRoutes
