import type { FastifyPluginAsync } from 'fastify'
import { IngestEventSchema } from '@customerEQ/shared'
import { enqueueEvent, enqueueCampaignTrigger } from '../queues/bullmq.js'
import type { TriggerCondition } from '@customerEQ/shared'

export function evaluateTriggerCondition(
  condition: TriggerCondition,
  payload: Record<string, unknown>,
): boolean {
  const fieldValue = payload[condition.field]

  // Coerce numeric strings so comparisons like lte("6") vs 4 work
  const condValue = typeof condition.value === 'string' && !isNaN(Number(condition.value))
    ? Number(condition.value)
    : condition.value

  switch (condition.op) {
    case 'eq':
      return fieldValue === condValue
    case 'ne':
      return fieldValue !== condValue
    case 'lt':
      return typeof fieldValue === 'number' && typeof condValue === 'number'
        ? fieldValue < condValue
        : false
    case 'lte':
      return typeof fieldValue === 'number' && typeof condValue === 'number'
        ? fieldValue <= condValue
        : false
    case 'gt':
      return typeof fieldValue === 'number' && typeof condValue === 'number'
        ? fieldValue > condValue
        : false
    case 'gte':
      return typeof fieldValue === 'number' && typeof condValue === 'number'
        ? fieldValue >= condValue
        : false
    case 'in':
      return Array.isArray(condition.value) && (condition.value as unknown[]).includes(fieldValue)
    case 'contains':
      return typeof fieldValue === 'string' && typeof condValue === 'string'
        ? fieldValue.includes(condValue)
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
    // Prefer Redis (fast path, 24hr TTL) when available; fall back to DB lookup
    // on the LoyaltyEvent.idempotencyKey column. Redis is an optimization, not
    // a hard dependency — the DB column has a unique index for correctness.
    if (idempotencyKey) {
      if (fastify.redis) {
        const redisKey = `idempotency:${brandId}:${idempotencyKey}`
        const existing = await fastify.redis.get(redisKey)
        if (existing !== null) {
          return reply.status(200).send({
            cached: true,
            message: 'duplicate event',
            jobId: existing,
          })
        }
      } else {
        const existing = await fastify.prisma.loyaltyEvent.findFirst({
          where: { brandId, idempotencyKey },
          select: { id: true },
        })
        if (existing) {
          return reply.status(200).send({
            cached: true,
            message: 'duplicate event',
            jobId: existing.id,
          })
        }
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
    if (idempotencyKey && fastify.redis) {
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
