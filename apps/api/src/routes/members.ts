import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { verifyToken } from '@clerk/backend'
import {
  EnrollMemberSchema,
  Customer360QuerySchema,
  SearchMembersQuerySchema,
  type Customer360Query,
} from '@customerEQ/shared'
import { enqueueEvent, enqueueNotification } from '../queues/bullmq.js'

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

  // ---------------------------------------------------------------------------
  // GET /v1/members/:id/360 — Customer 360 view (Issue #98)
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string }; Querystring: Customer360Query }>(
    '/members/:id/360',
    async (request, reply) => {
      const { eventsLimit, surveysLimit, redemptionsLimit, campaignEventsLimit } =
        Customer360QuerySchema.parse(request.query)

      // 1. Fetch member with tier
      const member = await fastify.prisma.member.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
        include: {
          currentTier: {
            select: { id: true, name: true, rank: true, benefits: true, multiplier: true },
          },
        },
      })
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      // 2. Mask PII if erased (C-GDPR-1, C-CCPA-1)
      const profile = member.erased
        ? { ...member, email: '[ERASED]', firstName: '[ERASED]', lastName: '[ERASED]', phone: '[ERASED]' }
        : member

      // 3. Parallel queries for sub-collections
      const [events, eventCount, surveys, surveyCount, redemptions, redemptionCount,
             campaignEvents, ceCount, openCases, stats, redemptionStats, sentimentStats] = await Promise.all([
        // Recent events
        fastify.prisma.loyaltyEvent.findMany({
          where: { memberId: member.id, brandId: request.brandId },
          orderBy: { createdAt: 'desc' },
          take: eventsLimit + 1,
        }),
        fastify.prisma.loyaltyEvent.count({
          where: { memberId: member.id, brandId: request.brandId },
        }),
        // Survey responses
        fastify.prisma.surveyResponse.findMany({
          where: { memberId: member.id, brandId: request.brandId },
          orderBy: { completedAt: 'desc' },
          take: surveysLimit + 1,
          include: { survey: { select: { name: true, type: true } } },
        }),
        fastify.prisma.surveyResponse.count({
          where: { memberId: member.id, brandId: request.brandId },
        }),
        // Redemptions
        fastify.prisma.redemption.findMany({
          where: { memberId: member.id, brandId: request.brandId },
          orderBy: { createdAt: 'desc' },
          take: redemptionsLimit + 1,
          include: { reward: { select: { name: true } } },
        }),
        fastify.prisma.redemption.count({
          where: { memberId: member.id, brandId: request.brandId },
        }),
        // Campaign events
        fastify.prisma.campaignEvent.findMany({
          where: { memberId: member.id, brandId: request.brandId },
          orderBy: { triggeredAt: 'desc' },
          take: campaignEventsLimit + 1,
          include: { campaign: { select: { name: true } } },
        }),
        fastify.prisma.campaignEvent.count({
          where: { memberId: member.id, brandId: request.brandId },
        }),
        // Open cases (all, no limit — typically small)
        fastify.prisma.caseFollowUp.findMany({
          where: { memberId: member.id, brandId: request.brandId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        }),
        // Aggregated stats
        fastify.prisma.loyaltyEvent.aggregate({
          where: { memberId: member.id, brandId: request.brandId },
          _sum: { pointsEarned: true },
        }),
        // Total points redeemed (aggregate across all redemptions, not just current page)
        fastify.prisma.redemption.aggregate({
          where: { memberId: member.id, brandId: request.brandId },
          _sum: { pointsSpent: true },
        }),
        // Average sentiment across all survey responses (not just current page)
        fastify.prisma.surveyResponse.aggregate({
          where: { memberId: member.id, brandId: request.brandId, sentiment: { not: null } },
          _avg: { sentiment: true },
        }),
      ])

      // 4. Compute summary stats (using DB aggregates for accuracy across all records)
      const totalPointsEarned = stats._sum.pointsEarned ?? 0
      const totalPointsRedeemed = redemptionStats._sum.pointsSpent ?? 0
      const avgSentiment = sentimentStats._avg.sentiment ?? null

      // 5. Audit log for 360 access (fire-and-forget, C-CCPA-2)
      fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId ?? 'system',
          action: 'member.360.accessed',
          resourceType: 'Member',
          resourceId: member.id,
        },
      }).catch((err) => fastify.log.error({ err }, 'Failed to log 360 audit event'))

      // 6. Log
      if (member.erased) {
        fastify.log.info({ memberId: member.id, brandId: request.brandId }, 'member.360.erased')
      }
      fastify.log.info(
        { memberId: member.id, brandId: request.brandId, eventCount, surveyCount, redemptionCount },
        'member.360.fetched',
      )

      // 7. Build response with hasMore flags
      return reply.status(200).send({
        member: {
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          pointsBalance: profile.pointsBalance,
          status: profile.status,
          enrollmentDate: profile.createdAt,
          consentGivenAt: profile.consentGivenAt,
          consentVersion: profile.consentVersion,
          tier: profile.currentTier,
          healthScore: (member as Record<string, unknown>).healthScore ?? null,
          healthScoreUpdatedAt: (member as Record<string, unknown>).healthScoreUpdatedAt ?? null,
        },
        recentEvents: {
          items: events.slice(0, eventsLimit).map((e) => ({
            id: e.id,
            eventType: e.eventType,
            pointsEarned: e.pointsEarned,
            payload: e.payload,
            createdAt: e.createdAt,
          })),
          hasMore: events.length > eventsLimit,
          total: eventCount,
        },
        surveyResponses: {
          items: surveys.slice(0, surveysLimit).map((s) => ({
            id: s.id,
            surveyName: s.survey.name,
            surveyType: s.survey.type,
            score: s.score,
            sentiment: s.sentiment,
            topics: s.topics,
            summary: s.summary,
            completedAt: s.completedAt,
          })),
          hasMore: surveys.length > surveysLimit,
          total: surveyCount,
        },
        redemptions: {
          items: redemptions.slice(0, redemptionsLimit).map((r) => ({
            id: r.id,
            rewardName: r.reward.name,
            pointsSpent: r.pointsSpent,
            status: r.status,
            createdAt: r.createdAt,
          })),
          hasMore: redemptions.length > redemptionsLimit,
          total: redemptionCount,
        },
        campaignEvents: {
          items: campaignEvents.slice(0, campaignEventsLimit).map((ce) => ({
            id: ce.id,
            campaignName: ce.campaign.name,
            triggeredAt: ce.triggeredAt,
            status: ce.status,
            result: ce.result,
          })),
          hasMore: campaignEvents.length > campaignEventsLimit,
          total: ceCount,
        },
        openCases: openCases.map((c) => ({
          id: c.id,
          status: c.status,
          priority: c.priority,
          assignee: c.assignee,
          slaDeadline: c.slaDeadline,
          createdAt: c.createdAt,
        })),
        stats: {
          totalEvents: eventCount,
          totalSurveyResponses: surveyCount,
          averageSentiment: avgSentiment,
          totalPointsEarned,
          totalPointsRedeemed,
        },
      })
    },
  )

  // ---------------------------------------------------------------------------
  // GET /v1/members — Search members (Issue #98)
  // ---------------------------------------------------------------------------
  fastify.get('/members', async (request, reply) => {
    const query = SearchMembersQuerySchema.parse(request.query)
    const { q, tier, sentimentMin, sentimentMax, npsMin, npsMax,
            balanceMin, balanceMax, healthScoreMin, healthScoreMax,
            status, enrolledAfter, enrolledBefore,
            page, pageSize, sortBy, sortOrder } = query

    // Build Prisma where clause
    const where: Prisma.MemberWhereInput = {
      brandId: request.brandId,
      deletedAt: null,
    }

    // Text search (ILIKE via Prisma mode: 'insensitive')
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Behavioral filters
    if (tier) {
      where.currentTier = { name: { equals: tier, mode: 'insensitive' } }
    }
    if (status) where.status = status
    if (balanceMin !== undefined) where.pointsBalance = { ...(where.pointsBalance as object), gte: balanceMin }
    if (balanceMax !== undefined) where.pointsBalance = { ...(where.pointsBalance as object), lte: balanceMax }
    if (enrolledAfter) where.createdAt = { ...(where.createdAt as object), gte: new Date(enrolledAfter) }
    if (enrolledBefore) where.createdAt = { ...(where.createdAt as object), lte: new Date(enrolledBefore) }
    if (healthScoreMin !== undefined) where.healthScore = { ...(where.healthScore as object), gte: healthScoreMin }
    if (healthScoreMax !== undefined) where.healthScore = { ...(where.healthScore as object), lte: healthScoreMax }

    // Sentiment/NPS filtering — applied to each member's LATEST survey response
    // (not any historical response). The displayed latestNpsScore/latestSentiment
    // must match the filter, otherwise results mislead the user.
    const needsSurveyFilter = sentimentMin !== undefined || sentimentMax !== undefined ||
                              npsMin !== undefined || npsMax !== undefined

    if (needsSurveyFilter) {
      const matchingRows = await fastify.prisma.$queryRaw<{ memberId: string }[]>`
        SELECT "memberId" FROM (
          SELECT DISTINCT ON (sr."memberId")
            sr."memberId", sr.score, sr.sentiment
          FROM survey_responses sr
          WHERE sr."brandId" = ${request.brandId}
          ORDER BY sr."memberId", sr."completedAt" DESC NULLS LAST, sr."createdAt" DESC
        ) latest
        WHERE
          (${npsMin ?? null}::int IS NULL OR latest.score >= ${npsMin ?? null}::int)
          AND (${npsMax ?? null}::int IS NULL OR latest.score <= ${npsMax ?? null}::int)
          AND (${sentimentMin ?? null}::float IS NULL OR latest.sentiment >= ${sentimentMin ?? null}::float)
          AND (${sentimentMax ?? null}::float IS NULL OR latest.sentiment <= ${sentimentMax ?? null}::float)
      `
      const matchingIds = matchingRows.map((r) => r.memberId)
      where.id = { in: matchingIds.length > 0 ? matchingIds : ['__none__'] }
    }

    // Sort mapping
    const orderByMap: Record<string, Prisma.MemberOrderByWithRelationInput> = {
      name: { firstName: sortOrder },
      email: { email: sortOrder },
      pointsBalance: { pointsBalance: sortOrder },
      createdAt: { createdAt: sortOrder },
      healthScore: { healthScore: sortOrder },
    }

    const isSentimentSort = sortBy === 'sentiment'

    // Start timer before queries for accurate response time logging
    const responseTimeStart = Date.now()

    // Query with pagination
    const [members, total] = await Promise.all([
      fastify.prisma.member.findMany({
        where,
        orderBy: isSentimentSort ? { createdAt: 'desc' } : orderByMap[sortBy],
        take: isSentimentSort ? undefined : pageSize,
        skip: isSentimentSort ? undefined : (page - 1) * pageSize,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          pointsBalance: true,
          status: true,
          erased: true,
          createdAt: true,
          healthScore: true,
          healthScoreUpdatedAt: true,
          currentTier: { select: { name: true } },
          surveyResponses: {
            orderBy: { completedAt: 'desc' },
            take: 1,
            select: { sentiment: true, score: true },
          },
        },
      }),
      fastify.prisma.member.count({ where }),
    ])

    // Post-process: sentiment sort (if needed) + PII masking
    let results = members.map((m) => ({
      id: m.id,
      email: m.erased ? '[ERASED]' : m.email,
      firstName: m.erased ? '[ERASED]' : m.firstName,
      lastName: m.erased ? '[ERASED]' : m.lastName,
      pointsBalance: m.pointsBalance,
      status: m.status,
      tierName: m.currentTier?.name ?? null,
      healthScore: m.healthScore ?? null,
      healthScoreUpdatedAt: m.healthScoreUpdatedAt ?? null,
      latestSentiment: m.surveyResponses[0]?.sentiment ?? null,
      latestNpsScore: m.surveyResponses[0]?.score ?? null,
      createdAt: m.createdAt,
    }))

    if (isSentimentSort) {
      results.sort((a, b) => {
        const aVal = a.latestSentiment ?? (sortOrder === 'asc' ? Infinity : -Infinity)
        const bVal = b.latestSentiment ?? (sortOrder === 'asc' ? Infinity : -Infinity)
        return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
      })
      results = results.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    }

    fastify.log.info(
      {
        brandId: request.brandId,
        filterCount: Object.keys(query).filter((k) => query[k as keyof typeof query] !== undefined).length,
        resultCount: total,
        responseTimeMs: Date.now() - responseTimeStart,
      },
      'member.search.executed',
    )

    return reply.status(200).send({
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })
}

export default membersRoutes
