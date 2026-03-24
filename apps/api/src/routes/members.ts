import type { FastifyPluginAsync } from 'fastify'
import { EnrollMemberSchema } from '@customerEQ/shared'

const membersRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/members/enroll
  fastify.post('/members/enroll', async (request, reply) => {
    const parse = EnrollMemberSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data

    // Verify the referenced program belongs to this brand
    const program = await fastify.prisma.program.findFirst({
      where: { id: data.programId, brandId: request.brandId },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    // Idempotent upsert by { brandId, email }
    const existing = await fastify.prisma.member.findUnique({
      where: {
        brandId_email: {
          brandId: request.brandId,
          email: data.email,
        },
      },
    })

    if (existing) {
      return reply.status(200).send(existing)
    }

    const member = await fastify.prisma.member.create({
      data: {
        brandId: request.brandId,
        email: data.email,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        phone: data.phone ?? undefined,
        pointsBalance: 0,
        status: 'ACTIVE',
        consentGivenAt: new Date(data.consentGivenAt),
        consentVersion: data.consentVersion,
      },
    })

    return reply.status(201).send(member)
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
