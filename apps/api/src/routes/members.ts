import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  EnrollMemberSchema,
  Customer360QuerySchema,
  SearchMembersQuerySchema,
  CreateMemberNoteSchema,
  UpdateMemberNoteSchema,
  floatToSentimentBucket,
  globToSqlLike,
  deriveSurveySuppression,
  type Customer360Query,
} from '@customerEQ/shared'
import { analyzeResponse } from '@customerEQ/ai'
import { enqueueEvent, enqueueNotification, enqueueHealthScoreComputation } from '../queues/bullmq.js'
import { resolveOrEnrollMember } from '../services/memberResolution.js'

function formatEventLabel(
  eventType: string,
  pointsEarned: number,
  payload: Record<string, unknown> | null,
): string {
  if (eventType === 'purchase' && pointsEarned === 0) {
    return 'Ineligible action — no matching rule'
  }
  switch (eventType) {
    case 'purchase':
      return payload?.orderId ? `Purchase — Order #${payload.orderId}` : 'Purchase'
    case 'enrollment':
      return payload?.programName ? `Enrolled in ${String(payload.programName)}` : 'Program enrollment'
    case 'campaign_award':
      return payload?.campaignName ? `Campaign reward: ${String(payload.campaignName)}` : 'Campaign reward'
    case 'cx.nps_response':
    case 'cx.nps_submitted':
      return 'NPS survey completed'
    case 'cx.csat_response':
    case 'cx.csat_submitted':
      return 'CSAT survey completed'
    case 'cx.ces_response':
      return 'CES survey completed'
    case 'cx.survey_completed':
      return payload?.surveyName ? `Survey: ${String(payload.surveyName)}` : 'Survey completed'
    case 'cx.promoter_identified':
      return 'Identified as promoter'
    case 'tier.upgraded':
      return payload?.tierName ? `Tier upgraded to ${String(payload.tierName)}` : 'Tier upgrade'
    case 'redemption':
      return payload?.rewardName ? `Redeemed: ${String(payload.rewardName)}` : 'Reward redemption'
    default:
      return eventType.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

const membersRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/members/enroll — public route (new member has no org JWT yet).
  //
  // Issue #231 PR2: rewrite for the polymorphic identifier model.
  // - Lookup keyed on `(brandId, externalId)` derived from `memberId` (R4/R5).
  // - Idempotent upsert: re-enroll with the same memberId returns 200 with
  //   `updated`/`updatedFields` rather than 409 (R6). Bulk-import scripts
  //   can replay the same payload and get last-write-wins.
  // - `consentGivenAt` is optional; server-stamps `now()` if absent (R8).
  // - `enrolledVia = MANUAL_API` for this channel; immutable post-create (R15).
  // - Identifier-shape validation per `Brand.memberIdentifierKind` (R4) — a
  //   PHONE brand rejects a non-E.164 memberId with 400.
  //
  // brandId is derived from programId lookup, never from request body.
  // clerkToken (optional) is verified internally to capture clerkUserId.
  fastify.post('/members/enroll', { config: { public: true } }, async (request, reply) => {
    const parse = EnrollMemberSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data

    // Resolve clerkUserId from optional body token via the IdentityProvider
    // abstraction (Issue #170 OD-5; no direct @clerk imports).
    let clerkUserId: string | undefined
    if (data.clerkToken) {
      const session = await fastify.identityProvider.getSession(data.clerkToken)
      if (!session) {
        return reply.status(401).send({ error: 'Invalid Clerk token' })
      }
      clerkUserId = session.userId
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

    let result: Awaited<ReturnType<typeof resolveOrEnrollMember>>
    try {
      result = await resolveOrEnrollMember(fastify.prisma, brandId, {
        memberId: data.memberId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        consentGivenAt: data.consentGivenAt ? new Date(data.consentGivenAt) : undefined,
        consentVersion: data.consentVersion,
        emailOptIn: data.emailOptIn,
        smsOptIn: data.smsOptIn,
        clerkUserId,
        enrolledVia: 'MANUAL_API',
      })
    } catch (err: unknown) {
      // Race-condition duplicate (P2002 unique constraint) — another concurrent
      // enroll won the create. Re-resolve via a single follow-up call which
      // will hit the existing-member branch this time.
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        result = await resolveOrEnrollMember(fastify.prisma, brandId, {
          memberId: data.memberId,
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          consentGivenAt: data.consentGivenAt ? new Date(data.consentGivenAt) : undefined,
          consentVersion: data.consentVersion,
          emailOptIn: data.emailOptIn,
          smsOptIn: data.smsOptIn,
          clerkUserId,
          enrolledVia: 'MANUAL_API',
        })
      } else {
        throw err
      }
    }

    if (!result.ok) {
      return reply.status(400).send({
        error: result.error.code,
        message: result.error.message,
        expectedKind: result.error.expectedKind,
      })
    }

    const { member, created, updatedFields } = result
    const ingestedAt = new Date().toISOString()

    if (created) {
      // Enqueue enrollment loyalty event (non-blocking) — worker handles bonus points.
      // Only fired on first enrollment; re-enroll is a no-op for the loyalty pipeline.
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

      // Welcome notification — first enrollment only. The address goes to the
      // member's email if known; PHONE / CUSTOMER_ID brands without an email
      // skip notification at the API layer (worker no-ops on null channel).
      if (member.email) {
        enqueueNotification({
          memberId: member.id,
          brandId,
          channel: 'email',
          message: `Welcome to ${program.name}! You're now enrolled and earning points.`,
          metadata: { programName: program.name, enrollmentBonusPending: true },
        }).catch((err: unknown) => {
          fastify.log.error({ err, memberId: member.id }, 'Failed to enqueue welcome notification')
        })
      }

      fastify.log.info({ memberId: member.id, brandId, programId: program.id }, 'member.enrolled')

      return reply.status(201).send({
        memberId: member.id,
        email: member.email,
        firstName: member.firstName ?? null,
        pointsBalance: member.pointsBalance,
        programName: program.name,
        enrolledVia: member.enrolledVia,
        enrollmentBonusPending: true,
      })
    }

    // R6 idempotent re-enroll — return 200 with the change set.
    fastify.log.info(
      { memberId: member.id, brandId, programId: program.id, updatedFields },
      'member.reenrolled',
    )

    return reply.status(200).send({
      memberId: member.id,
      email: member.email,
      firstName: member.firstName ?? null,
      pointsBalance: member.pointsBalance,
      programName: program.name,
      enrolledVia: member.enrolledVia,
      enrollmentBonusPending: false,
      updated: updatedFields.length > 0,
      updatedFields,
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

  // ---------------------------------------------------------------------------
  // GET /v1/members/me/dashboard — full dashboard payload (Issue #75)
  // Returns all data needed for the member dashboard in one call:
  // balance, tier progress, affordable reward CTA, onboarding state, activity.
  // Kept separate from /balance so the lightweight header badge call stays fast.
  // ---------------------------------------------------------------------------
  fastify.get('/members/me/dashboard', async (request, reply) => {
    const member = await fastify.prisma.member.findFirst({
      where: {
        clerkUserId: request.clerkUserId,
        brandId: request.brandId,
        deletedAt: null,
      },
      select: {
        id: true,
        pointsBalance: true,
        currentTierId: true,
        currentTier: {
          select: { id: true, name: true, rank: true, icon: true, benefits: true, minPoints: true },
        },
      },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    const [recentEvents, program, tiers, affordableReward, hasPurchase] = await Promise.all([
      fastify.prisma.loyaltyEvent.findMany({
        where: { memberId: member.id, brandId: request.brandId, pointsEarned: { gt: 0 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      fastify.prisma.program.findFirst({
        where: { brandId: request.brandId, status: 'ACTIVE' },
        select: { pointCurrencyName: true, pointToCurrencyRatio: true },
      }),
      fastify.prisma.tier.findMany({
        where: { brandId: request.brandId, deletedAt: null },
        orderBy: { rank: 'asc' },
        select: { id: true, name: true, rank: true, icon: true, benefits: true, minPoints: true },
      }),
      // Most valuable reward the member can afford
      fastify.prisma.reward.findFirst({
        where: {
          brandId: request.brandId,
          isAvailable: true,
          deletedAt: null,
          pointsCost: { lte: member.pointsBalance },
          OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        orderBy: { pointsCost: 'desc' },
        select: { id: true, name: true, pointsCost: true },
      }),
      fastify.prisma.loyaltyEvent.findFirst({
        where: { memberId: member.id, brandId: request.brandId, eventType: 'purchase', pointsEarned: { gt: 0 } },
        select: { id: true },
      }),
    ])

    // Running balance for activity feed (events newest-first)
    let running = member.pointsBalance
    const recentActivity = recentEvents.map((e) => {
      const bal = running
      running -= e.pointsEarned
      return {
        id: e.id,
        date: e.createdAt,
        event: formatEventLabel(e.eventType, e.pointsEarned, e.payload as Record<string, unknown> | null),
        points: e.pointsEarned,
        balance: bal,
      }
    })

    // Tier progress toward the next tier
    let tierProgress: { nextTierName: string; minPoints: number; pointsToNext: number; pct: number } | null = null
    const currentRank = member.currentTier?.rank ?? 0
    const nextTier = tiers.find((t) => t.rank > currentRank && (t.minPoints ?? 0) > member.pointsBalance)
    if (nextTier?.minPoints != null) {
      const baseMin = member.currentTier?.minPoints ?? 0
      const range = nextTier.minPoints - baseMin
      const progress = member.pointsBalance - baseMin
      tierProgress = {
        nextTierName: nextTier.name,
        minPoints: nextTier.minPoints,
        pointsToNext: Math.max(0, nextTier.minPoints - member.pointsBalance),
        pct: range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100,
      }
    }

    return reply.status(200).send({
      pointsBalance: member.pointsBalance,
      currencyName: program?.pointCurrencyName ?? 'Points',
      currencyEquivalent: program
        ? Number((member.pointsBalance * program.pointToCurrencyRatio).toFixed(2))
        : null,
      tier: member.currentTier
        ? {
            id: member.currentTier.id,
            name: member.currentTier.name,
            rank: member.currentTier.rank,
            icon: member.currentTier.icon ?? null,
          }
        : null,
      tierProgress,
      affordableReward: affordableReward ?? null,
      onboarding: { hasFirstPurchase: hasPurchase !== null },
      recentActivity,
    })
  })

  // ---------------------------------------------------------------------------
  // GET /v1/members/me/events — paginated loyalty event history (Issue #75 R5/R6)
  // ---------------------------------------------------------------------------
  const EventsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })

  fastify.get('/members/me/events', async (request, reply) => {
    const { page, limit } = EventsQuerySchema.parse(request.query)

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

    const skip = (page - 1) * limit
    const [events, total] = await Promise.all([
      fastify.prisma.loyaltyEvent.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      fastify.prisma.loyaltyEvent.count({
        where: { memberId: member.id, brandId: request.brandId },
      }),
    ])

    // Compute running balance for this page by summing events above it
    let pageStartBalance = member.pointsBalance
    if (skip > 0) {
      const above = await fastify.prisma.loyaltyEvent.aggregate({
        where: {
          memberId: member.id,
          brandId: request.brandId,
          createdAt: { gt: events[0]?.createdAt ?? new Date() },
        },
        _sum: { pointsEarned: true },
      })
      pageStartBalance = member.pointsBalance - (above._sum.pointsEarned ?? 0)
    }

    let running = pageStartBalance
    const items = events.map((e) => {
      const bal = running
      running -= e.pointsEarned
      return {
        id: e.id,
        date: e.createdAt,
        event: formatEventLabel(e.eventType, e.pointsEarned, e.payload as Record<string, unknown> | null),
        points: e.pointsEarned,
        balance: bal,
        rulesApplied: e.rulesApplied,
      }
    })

    return reply.status(200).send({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
      const {
        eventsLimit,
        surveysLimit,
        redemptionsLimit,
        campaignEventsLimit,
        externalSignalsLimit,
      } = Customer360QuerySchema.parse(request.query)

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
             campaignEvents, ceCount, externalSignals, externalSignalCount, openCases, openConversations, stats, redemptionStats, sentimentStats] = await Promise.all([
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
        fastify.prisma.externalSignal.findMany({
          where: {
            memberId: member.id,
            brandId: request.brandId,
            matchStatus: 'MATCHED',
            status: 'ACTIVE',
          },
          orderBy: [{ postedAt: 'desc' }, { ingestedAt: 'desc' }],
          take: externalSignalsLimit + 1,
          include: {
            source: { select: { id: true, name: true } },
          },
        }),
        fastify.prisma.externalSignal.count({
          where: {
            memberId: member.id,
            brandId: request.brandId,
            matchStatus: 'MATCHED',
            status: 'ACTIVE',
          },
        }),
        fastify.prisma.caseFollowUp.findMany({
          where: { memberId: member.id, brandId: request.brandId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        }),
        // Open support conversations (active/waiting/escalated — excludes RESOLVED/CLOSED)
        fastify.prisma.conversation.findMany({
          where: {
            memberId: member.id,
            brandId: request.brandId,
            status: { in: ['ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED'] },
          },
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { messages: true } } },
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
          healthScoreBreakdown: (member as Record<string, unknown>).healthScoreBreakdown ?? null,
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
        externalSignals: {
          items: externalSignals.slice(0, externalSignalsLimit).map((signal) => ({
            id: signal.id,
            sourceId: signal.sourceId,
            sourceType: signal.sourceType,
            sourceName: signal.source.name,
            body: signal.body,
            summary: signal.summary,
            rating: signal.rating,
            sentiment: signal.sentiment,
            topics: signal.topics,
            canonicalUrl: signal.canonicalUrl,
            externalAuthorLabel: signal.externalAuthorLabel,
            subjectLabel: signal.subjectLabel,
            postedAt: signal.postedAt,
            matchConfidence: signal.matchConfidence,
          })),
          hasMore: externalSignals.length > externalSignalsLimit,
          total: externalSignalCount,
        },
        openCases: openCases.map((c) => ({
          id: c.id,
          status: c.status,
          priority: c.priority,
          assignee: c.assignee,
          slaDeadline: c.slaDeadline,
          createdAt: c.createdAt,
        })),
        openConversations: openConversations.map((c) => ({
          id: c.id,
          status: c.status,
          intent: c.intent,
          topic: c.topic,
          summary: c.summary,
          assignee: c.assignee,
          messageCount: c._count.messages,
          escalatedAt: c.escalatedAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
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

    // Text search.
    // - Default: substring ILIKE via Prisma `contains` (backward-compat).
    // - Glob mode (Issue #420 / R17): when q contains `*` or `?`, translate to
    //   SQL LIKE (`*`→`%`, `?`→`_`) with operator-literal `%`/`_`/`\` escaped
    //   via `globToSqlLike`, then OR-match against externalId / email /
    //   firstName / lastName. Used by the #420 audience-builder wildcard
    //   search. Backward-compatible: queries without `*`/`?` keep the existing
    //   substring behavior.
    if (q) {
      const isGlob = /[*?]/.test(q)
      if (isGlob) {
        const likePattern = globToSqlLike(q)
        const matching = await fastify.prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "members"
          WHERE "brandId" = ${request.brandId}
            AND "deletedAt" IS NULL
            AND (
              "externalId" ILIKE ${likePattern} ESCAPE '\\'
              OR "email" ILIKE ${likePattern} ESCAPE '\\'
              OR "firstName" ILIKE ${likePattern} ESCAPE '\\'
              OR "lastName" ILIKE ${likePattern} ESCAPE '\\'
            )
        `
        const ids = matching.map((r) => r.id)
        where.id = { in: ids.length > 0 ? ids : ['__none__'] }
      } else {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ]
      }
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
          externalId: true,
          email: true,
          firstName: true,
          lastName: true,
          pointsBalance: true,
          status: true,
          erased: true,
          consentGivenAt: true,
          unsubscribedSurveysAt: true,
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
    let results = members.map((m) => {
      // Issue #420 R22/R43/R44 — derive a survey-send suppression chip per
      // member. The audience-builder UI (apps/web/...audience-builder) renders
      // this chip on Search-tab results and on accumulated-audience rows so the
      // operator can see who can't be sent to *before* clicking Send. The
      // worker re-checks all four conditions at dispatch time (R44) — this is
      // purely a UI preview. emailOptIn is INTENTIONALLY EXCLUDED per R44 (the
      // marketing-channel opt-out doesn't gate surveys).
      const suppression = deriveSurveySuppression({
        erased: m.erased,
        email: m.email,
        consentGivenAt: m.consentGivenAt,
        unsubscribedSurveysAt: m.unsubscribedSurveysAt,
      })
      return {
        id: m.id,
        externalId: m.externalId,
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
        suppressionStatus: suppression.status,
        suppressionSince: suppression.since,
      }
    })

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

  // ---------------------------------------------------------------------------
  // GET /v1/members/:id/notes — list CRM notes on a customer (newest first)
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>('/members/:id/notes', async (request, reply) => {
    const { id } = request.params
    const member = await fastify.prisma.member.findFirst({
      where: { id, brandId: request.brandId, deletedAt: null },
      select: { id: true },
    })
    if (!member) return reply.status(404).send({ error: 'Customer not found' })

    const notes = await fastify.prisma.memberNote.findMany({
      where: { brandId: request.brandId, memberId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.status(200).send({ data: notes, total: notes.length })
  })

  // ---------------------------------------------------------------------------
  // POST /v1/members/:id/notes — add a CRM note to a customer (append-only)
  // ---------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>('/members/:id/notes', async (request, reply) => {
    const { id } = request.params

    const parse = CreateMemberNoteSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }
    const input = parse.data

    const member = await fastify.prisma.member.findFirst({
      where: { id, brandId: request.brandId, deletedAt: null },
      select: { id: true },
    })
    if (!member) return reply.status(404).send({ error: 'Customer not found' })

    const author = input.author || request.clerkUserId || 'system'

    // Issue #141: when the caller didn't pick a sentiment, run the note
    // body through the existing AI sentiment analyzer and map the float
    // score to our 5-bucket string enum. Manual selections always win.
    // AI failures degrade silently to null — the note is still saved.
    let resolvedSentiment = input.sentiment ?? null
    let sentimentAuto = false
    if (input.sentiment === undefined) {
      try {
        const analysis = await analyzeResponse(input.body, { surveyType: 'note' })
        const bucket = floatToSentimentBucket(analysis.sentiment)
        if (bucket !== null) {
          resolvedSentiment = bucket
          sentimentAuto = true
          fastify.log.info(
            { memberId: id, sentiment: bucket, score: analysis.sentiment },
            'note sentiment auto-computed',
          )
        }
      } catch (err) {
        fastify.log.warn(
          { err, memberId: id },
          'note sentiment auto-compute failed, falling back to null',
        )
      }
    }

    const note = await fastify.prisma.memberNote.create({
      data: {
        brandId: request.brandId,
        memberId: id,
        body: input.body,
        author,
        category: input.category ?? 'note',
        sentiment: resolvedSentiment,
      },
    })

    await fastify.prisma.auditEvent.create({
      data: {
        brandId: request.brandId,
        actorId: request.clerkUserId,
        action: 'member_note.create',
        resourceType: 'MemberNote',
        resourceId: note.id,
        metadata: { memberId: id, category: note.category, sentiment: note.sentiment, sentimentAuto },
      },
    })

    // If the note carried a sentiment tag (manual or auto), trigger a
    // health-score recompute for this member — reps expect the score to
    // reflect their observation immediately, not wait for the next batch.
    if (note.sentiment) {
      enqueueHealthScoreComputation({ brandId: request.brandId, memberId: id }).catch((err) =>
        fastify.log.warn({ err, memberId: id }, 'health-score recompute after note failed'),
      )
    }

    return reply.status(201).send({ ...note, sentimentAuto })
  })

  // ---------------------------------------------------------------------------
  // PATCH /v1/members/:id/notes/:noteId — edit a note (body/category/sentiment)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string; noteId: string } }>(
    '/members/:id/notes/:noteId',
    async (request, reply) => {
      const { id, noteId } = request.params

      const parse = UpdateMemberNoteSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }
      const input = parse.data

      const existing = await fastify.prisma.memberNote.findFirst({
        where: { id: noteId, memberId: id, brandId: request.brandId },
      })
      if (!existing) return reply.status(404).send({ error: 'Note not found' })

      const data: {
        body?: string
        category?: string | null
        sentiment?: string | null
      } = {}
      if (input.body !== undefined) data.body = input.body
      if (input.category !== undefined) data.category = input.category
      if (input.sentiment !== undefined) data.sentiment = input.sentiment

      const updated = await fastify.prisma.memberNote.update({
        where: { id: noteId },
        data,
      })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'member_note.update',
          resourceType: 'MemberNote',
          resourceId: noteId,
          metadata: {
            memberId: id,
            changedFields: Object.keys(data),
            previousSentiment: existing.sentiment,
            newSentiment: updated.sentiment,
          },
        },
      })

      // Recompute health score if sentiment changed — the rep either added,
      // removed, or shifted their override on this customer.
      if (existing.sentiment !== updated.sentiment) {
        enqueueHealthScoreComputation({ brandId: request.brandId, memberId: id }).catch((err) =>
          fastify.log.warn({ err, memberId: id }, 'health-score recompute after note edit failed'),
        )
      }

      return reply.status(200).send(updated)
    },
  )

  // ---------------------------------------------------------------------------
  // DELETE /v1/members/:id/notes/:noteId — remove a note
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string; noteId: string } }>(
    '/members/:id/notes/:noteId',
    async (request, reply) => {
      const { id, noteId } = request.params

      const existing = await fastify.prisma.memberNote.findFirst({
        where: { id: noteId, memberId: id, brandId: request.brandId },
      })
      if (!existing) return reply.status(404).send({ error: 'Note not found' })

      await fastify.prisma.memberNote.delete({ where: { id: noteId } })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'member_note.delete',
          resourceType: 'MemberNote',
          resourceId: noteId,
          metadata: {
            memberId: id,
            deletedSentiment: existing.sentiment,
            deletedCategory: existing.category,
          },
        },
      })

      // If the deleted note had a sentiment tag, recompute — the next-most-recent
      // tagged note (or none) now drives the modifier.
      if (existing.sentiment) {
        enqueueHealthScoreComputation({ brandId: request.brandId, memberId: id }).catch((err) =>
          fastify.log.warn({ err, memberId: id }, 'health-score recompute after note delete failed'),
        )
      }

      return reply.status(204).send()
    },
  )
}

export default membersRoutes
