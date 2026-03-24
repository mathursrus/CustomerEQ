import type { FastifyPluginAsync } from 'fastify'
import { IngestEventSchema } from '@customerEQ/shared'
import { enqueueEvent, enqueueCampaignTrigger } from '../queues/bullmq.js'
import type { TriggerCondition } from '@customerEQ/shared'

function evaluateTriggerCondition(
  condition: TriggerCondition,
  payload: Record<string, unknown>,
): boolean {
  const fieldValue = payload[condition.field]

  switch (condition.op) {
    case 'eq':
      return fieldValue === condition.value
    case 'ne':
      return fieldValue !== condition.value
    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number'
        ? fieldValue < condition.value
        : false
    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number'
        ? fieldValue <= condition.value
        : false
    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number'
        ? fieldValue > condition.value
        : false
    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number'
        ? fieldValue >= condition.value
        : false
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)
    case 'contains':
      return typeof fieldValue === 'string' && typeof condition.value === 'string'
        ? fieldValue.includes(condition.value)
        : false
    default:
      return false
  }
}

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/events — critical path event ingestion
  fastify.post('/events', async (request, reply) => {
    const parse = IngestEventSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const { eventType, memberId, payload, idempotencyKey } = parse.data
    const brandId = request.brandId
    const ingestedAt = new Date().toISOString()

    // Step 1: Idempotency check
    if (idempotencyKey) {
      const redisKey = `idempotency:${brandId}:${idempotencyKey}`
      const existing = await fastify.redis.get(redisKey)
      if (existing !== null) {
        return reply.status(200).send({
          cached: true,
          message: 'duplicate event',
          jobId: existing,
        })
      }
    }

    // Step 2: Validate member exists and has consent
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, brandId, deletedAt: null },
      select: { id: true, consentGivenAt: true },
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    if (!member.consentGivenAt) {
      return reply.status(422).send({ error: 'member consent required' })
    }

    // Step 3: Enqueue to loyalty-events queue
    const job = await enqueueEvent({
      brandId,
      memberId,
      eventType,
      payload: payload as Record<string, unknown>,
      idempotencyKey: idempotencyKey ?? undefined,
      ingestedAt,
    })

    // Store idempotency key in Redis (24hr TTL)
    if (idempotencyKey) {
      const redisKey = `idempotency:${brandId}:${idempotencyKey}`
      await fastify.redis.set(redisKey, job.id ?? 'queued', 'EX', 86400)
    }

    // Step 4: Evaluate active campaigns (sync, fast path)
    const now = new Date()
    const activeCampaigns = await fastify.prisma.campaign.findMany({
      where: {
        brandId,
        status: 'ACTIVE',
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    })

    for (const campaign of activeCampaigns) {
      // Check if triggerType matches eventType
      if (campaign.triggerType !== eventType) continue

      // Evaluate trigger condition against payload
      const condition = campaign.triggerCondition as TriggerCondition
      const payloadObj = payload as Record<string, unknown>

      if (!evaluateTriggerCondition(condition, payloadObj)) continue

      // Enqueue campaign trigger (high priority)
      enqueueCampaignTrigger({
        brandId,
        campaignId: campaign.id,
        memberId,
        eventIngestedAt: ingestedAt,
        sourceEventId: job.id,
      }).catch((err: unknown) => {
        fastify.log.error({ err, campaignId: campaign.id }, 'Failed to enqueue campaign trigger')
      })
    }

    return reply.status(202).send({
      jobId: job.id,
      message: 'event accepted',
    })
  })

  // GET /v1/events — admin list of recent loyalty events for the brand
  fastify.get('/events', async (request, reply) => {
    const events = await fastify.prisma.loyaltyEvent.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.status(200).send(events)
  })
}

export default eventsRoutes
