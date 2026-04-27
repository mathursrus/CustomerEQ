import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'node:crypto'
import { CreateWebhookEndpointSchema, UpdateWebhookEndpointSchema } from '@customerEQ/shared'
import { enqueueWebhookDelivery } from '../queues/bullmq.js'

const outboundWebhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/webhooks — create endpoint
  fastify.post('/webhooks', async (request, reply) => {
    const parse = CreateWebhookEndpointSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const signingSecret = randomBytes(32).toString('hex')

    const endpoint = await fastify.prisma.webhookEndpoint.create({
      data: {
        brandId: request.brandId,
        label: parse.data.label,
        url: parse.data.url,
        signingSecret,
        events: parse.data.events,
        active: true,
      },
    })

    // Return signing secret once — never returned again after this response
    return reply.status(201).send({
      id: endpoint.id,
      label: endpoint.label,
      url: endpoint.url,
      events: endpoint.events,
      active: endpoint.active,
      createdAt: endpoint.createdAt,
      // signingSecret is only included on creation
      signingSecret,
    })
  })

  // GET /v1/webhooks — list endpoints (no secret)
  fastify.get('/webhooks', async (request, reply) => {
    const endpoints = await fastify.prisma.webhookEndpoint.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return reply.status(200).send({ endpoints })
  })

  // GET /v1/webhooks/:id — get single endpoint (no secret)
  fastify.get('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const endpoint = await fastify.prisma.webhookEndpoint.findFirst({
      where: { id, brandId: request.brandId },
      select: {
        id: true,
        label: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!endpoint) return reply.status(404).send({ error: 'Endpoint not found' })
    return reply.status(200).send(endpoint)
  })

  // PATCH /v1/webhooks/:id — update endpoint
  fastify.patch('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateWebhookEndpointSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const existing = await fastify.prisma.webhookEndpoint.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Endpoint not found' })

    const updated = await fastify.prisma.webhookEndpoint.update({
      where: { id },
      data: parse.data,
      select: {
        id: true,
        label: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return reply.status(200).send(updated)
  })

  // DELETE /v1/webhooks/:id — delete endpoint
  fastify.delete('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await fastify.prisma.webhookEndpoint.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Endpoint not found' })

    await fastify.prisma.webhookEndpoint.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /v1/webhooks/:id/deliveries — list delivery logs
  fastify.get('/webhooks/:id/deliveries', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await fastify.prisma.webhookEndpoint.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Endpoint not found' })

    const logs = await fastify.prisma.webhookDeliveryLog.findMany({
      where: { webhookEndpointId: id },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    })
    return reply.status(200).send({ deliveries: logs })
  })

  // POST /v1/webhooks/:id/test — fire a test delivery
  fastify.post('/webhooks/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await fastify.prisma.webhookEndpoint.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Endpoint not found' })

    await enqueueWebhookDelivery({
      webhookEndpointId: id,
      brandId: request.brandId,
      event: 'case.created',
      caseId: 'test-case-id',
      data: { test: true, message: 'This is a test delivery from CustomerEQ' },
    })

    return reply.status(202).send({ queued: true })
  })
}

export default outboundWebhooksRoutes
