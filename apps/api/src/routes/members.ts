import type { FastifyPluginAsync } from 'fastify'
import { verifyToken } from '@clerk/backend'
import { EnrollMemberSchema } from '@customerEQ/shared'
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
}

export default membersRoutes
