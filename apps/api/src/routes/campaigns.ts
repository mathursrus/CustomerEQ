import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateCampaignSchema, UpdateCampaignStatusSchema } from '@customerEQ/shared'

const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/campaigns
  fastify.post('/campaigns', async (request, reply) => {
    const parse = CreateCampaignSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data

    // Verify program belongs to this brand
    const program = await fastify.prisma.program.findFirst({
      where: { id: data.programId, brandId: request.brandId },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    const campaign = await fastify.prisma.campaign.create({
      data: {
        brandId: request.brandId,
        programId: data.programId,
        name: data.name,
        triggerType: data.triggerType,
        triggerCondition: data.triggerCondition as Prisma.InputJsonValue,
        actionType: data.actionType,
        actionConfig: data.actionConfig as Prisma.InputJsonValue,
        budgetCap: data.budgetCap ?? undefined,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: 'DRAFT',
      },
    })

    return reply.status(201).send(campaign)
  })

  // GET /v1/campaigns/:id
  fastify.get<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: {
        id: request.params.id,
        brandId: request.brandId,
      },
    })

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' })
    }

    return reply.status(200).send(campaign)
  })

  // PATCH /v1/campaigns/:id/status
  fastify.patch<{ Params: { id: string } }>(
    '/campaigns/:id/status',
    async (request, reply) => {
      const parse = UpdateCampaignStatusSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const existing = await fastify.prisma.campaign.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Campaign not found' })
      }

      const { status } = parse.data

      // Reject activation of a campaign with a past end date
      if (status === 'ACTIVE' && existing.endDate && existing.endDate < new Date()) {
        return reply.status(422).send({
          error: 'Cannot activate a campaign with a past end date.',
        })
      }

      const updated = await fastify.prisma.campaign.update({
        where: { id: request.params.id },
        data: { status },
      })

      return reply.status(200).send(updated)
    },
  )
}

export default campaignsRoutes
