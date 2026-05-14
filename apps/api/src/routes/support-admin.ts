import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  CreateSupportRuleSchema,
  UpdateSupportRuleSchema,
  SendMessageSchema,
  UpdateConversationStatusSchema,
} from '@customerEQ/shared'

const supportAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Conversations
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /v1/support/conversations — list conversations
  fastify.get('/support/conversations', async (request, reply) => {
    const brandId = request.brandId
    const { status, page: pageStr, pageSize: pageSizeStr } = request.query as {
      status?: string
      page?: string
      pageSize?: string
    }

    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr ?? '25', 10) || 25))

    const where: Prisma.ConversationWhereInput = { brandId }
    if (status) {
      where.status = status as Prisma.EnumConversationStatusFilter
    }

    const [total, data] = await Promise.all([
      fastify.prisma.conversation.count({ where }),
      fastify.prisma.conversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          member: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { messages: true } },
        },
      }),
    ])

    return reply.status(200).send({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })

  // GET /v1/support/conversations/:id — get conversation detail
  fastify.get('/support/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const conversation = await fastify.prisma.conversation.findFirst({
      where: { id, brandId: request.brandId },
      include: {
        member: { select: { id: true, email: true, firstName: true, lastName: true, pointsBalance: true, currentTier: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    return reply.status(200).send(conversation)
  })

  // POST /v1/support/conversations/:id/messages — send agent message
  fastify.post('/support/conversations/:id/messages', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string }

    const parse = SendMessageSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const conversation = await fastify.prisma.conversation.findFirst({
      where: { id: conversationId, brandId: request.brandId },
    })
    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    const message = await fastify.prisma.message.create({
      data: {
        conversationId,
        role: 'AGENT',
        content: parse.data.content,
      },
    })

    return reply.status(201).send(message)
  })

  // PATCH /v1/support/conversations/:id — update status
  fastify.patch('/support/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parse = UpdateConversationStatusSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const existing = await fastify.prisma.conversation.findFirst({
      where: { id, brandId: request.brandId },
      select: { id: true, updatedAt: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    // Optimistic-concurrency check (spec §7 invariant). When the caller supplies
    // expectedUpdatedAt, reject the write if another agent has updated the row.
    // This is the agent-collision guard that lets the UI prompt for a refresh
    // instead of silently overwriting another agent's status change.
    if (parse.data.expectedUpdatedAt !== undefined) {
      const expectedMs =
        typeof parse.data.expectedUpdatedAt === 'number'
          ? parse.data.expectedUpdatedAt
          : new Date(parse.data.expectedUpdatedAt).getTime()
      if (existing.updatedAt.getTime() !== expectedMs) {
        return reply.status(409).send({
          error: 'Conversation has been updated by another agent since you loaded it. Reload to see the latest state and try again.',
          currentUpdatedAt: existing.updatedAt.toISOString(),
        })
      }
    }

    const updateData: Prisma.ConversationUpdateInput = {
      status: parse.data.status,
    }
    if (parse.data.assignee) {
      updateData.assignee = parse.data.assignee
    }
    if (parse.data.status === 'ESCALATED') {
      updateData.escalatedAt = new Date()
    }
    if (parse.data.status === 'RESOLVED') {
      updateData.resolvedAt = new Date()
    }
    if (parse.data.status === 'CLOSED') {
      updateData.closedAt = new Date()
    }

    const updated = await fastify.prisma.conversation.update({
      where: { id },
      data: updateData,
    })

    return reply.status(200).send(updated)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Support Rules
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /v1/support/rules — list support rules
  fastify.get('/support/rules', async (request, reply) => {
    const rules = await fastify.prisma.supportRule.findMany({
      where: { brandId: request.brandId },
      orderBy: { priority: 'asc' },
    })
    return reply.status(200).send({ rules })
  })

  // POST /v1/support/rules — create support rule
  fastify.post('/support/rules', async (request, reply) => {
    const parse = CreateSupportRuleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const rule = await fastify.prisma.supportRule.create({
      data: {
        brandId: request.brandId,
        name: parse.data.name,
        description: parse.data.description,
        priority: parse.data.priority,
        intentFilters: parse.data.intentFilters,
        tierFilters: parse.data.tierFilters,
        healthScoreMin: parse.data.healthScoreMin,
        healthScoreMax: parse.data.healthScoreMax,
        topicFilters: parse.data.topicFilters,
        conditions: parse.data.conditions as unknown as Prisma.InputJsonValue,
        autoRespondArticleId: parse.data.autoRespondArticleId,
        escalateToAssignee: parse.data.escalateToAssignee,
        awardPoints: parse.data.awardPoints,
        triggerSurveyId: parse.data.triggerSurveyId,
      },
    })

    return reply.status(201).send(rule)
  })

  // GET /v1/support/rules/:id — get support rule
  fastify.get('/support/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rule = await fastify.prisma.supportRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!rule) {
      return reply.status(404).send({ error: 'Support rule not found' })
    }
    return reply.status(200).send(rule)
  })

  // PUT /v1/support/rules/:id — update support rule
  fastify.put('/support/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parse = UpdateSupportRuleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const existing = await fastify.prisma.supportRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Support rule not found' })
    }

    const data = { ...parse.data } as Record<string, unknown>
    if (data.conditions) {
      data.conditions = data.conditions as unknown as Prisma.InputJsonValue
    }

    const updated = await fastify.prisma.supportRule.update({
      where: { id },
      data: data as Prisma.SupportRuleUpdateInput,
    })

    return reply.status(200).send(updated)
  })

  // DELETE /v1/support/rules/:id — delete support rule
  fastify.delete('/support/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await fastify.prisma.supportRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Support rule not found' })
    }

    await fastify.prisma.supportRule.delete({ where: { id } })

    return reply.status(200).send({ deleted: true })
  })
}

export default supportAdminRoutes
