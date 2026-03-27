import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateAlertRuleSchema, UpdateAlertRuleSchema, UpdateAlertRuleStatusSchema } from '@customerEQ/shared'

const alertRulesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/alert-rules — list alert rules for the brand
  fastify.get('/alert-rules', async (request, reply) => {
    const rules = await fastify.prisma.alertRule.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cases: true } } },
    })
    return reply.status(200).send({ rules })
  })

  // POST /v1/alert-rules — create an alert rule
  fastify.post('/alert-rules', async (request, reply) => {
    const parse = CreateAlertRuleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const rule = await fastify.prisma.alertRule.create({
      data: {
        brandId: request.brandId,
        ...parse.data,
        assignmentRules: parse.data.assignmentRules as unknown as Prisma.InputJsonValue,
      },
    })

    return reply.status(201).send(rule)
  })

  // GET /v1/alert-rules/:id — get alert rule details
  fastify.get('/alert-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rule = await fastify.prisma.alertRule.findFirst({
      where: { id, brandId: request.brandId },
      include: { _count: { select: { cases: true } } },
    })
    if (!rule) return reply.status(404).send({ error: 'Alert rule not found' })

    // Mask sensitive webhook URLs in response
    const masked = {
      ...rule,
      slackWebhookUrl: rule.slackWebhookUrl ? '****' + rule.slackWebhookUrl.slice(-8) : null,
      teamsWebhookUrl: rule.teamsWebhookUrl ? '****' + rule.teamsWebhookUrl.slice(-8) : null,
    }
    return reply.status(200).send(masked)
  })

  // PATCH /v1/alert-rules/:id — update an alert rule
  fastify.patch('/alert-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateAlertRuleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const existing = await fastify.prisma.alertRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Alert rule not found' })

    const data = { ...parse.data } as Record<string, unknown>
    if (data.assignmentRules) {
      data.assignmentRules = data.assignmentRules as unknown as Prisma.InputJsonValue
    }

    const updated = await fastify.prisma.alertRule.update({
      where: { id },
      data: data as Prisma.AlertRuleUpdateInput,
    })

    return reply.status(200).send(updated)
  })

  // DELETE /v1/alert-rules/:id — delete (soft: set PAUSED and preserve cases)
  fastify.delete('/alert-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rule = await fastify.prisma.alertRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!rule) return reply.status(404).send({ error: 'Alert rule not found' })

    await fastify.prisma.alertRule.delete({ where: { id } })
    return reply.status(204).send()
  })

  // PATCH /v1/alert-rules/:id/status — activate or pause a rule
  fastify.patch('/alert-rules/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateAlertRuleStatusSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const rule = await fastify.prisma.alertRule.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!rule) return reply.status(404).send({ error: 'Alert rule not found' })

    const updated = await fastify.prisma.alertRule.update({
      where: { id },
      data: { status: parse.data.status },
    })

    return reply.status(200).send(updated)
  })
}

export default alertRulesRoutes
