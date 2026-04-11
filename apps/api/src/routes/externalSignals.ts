import type { FastifyPluginAsync } from 'fastify'
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client'
import {
  CreateExternalSignalSourceSchema,
  ExternalSignalSourceListQuerySchema,
  ExternalSignalsQuerySchema,
  TestExternalSignalSourceSchema,
  UpdateExternalSignalSourceSchema,
  extractExternalSignalDeliveries,
  normalizeExternalSignalCandidate,
} from '@customerEQ/shared'
import { enqueueExternalSignalSync } from '../queues/bullmq.js'

function buildSamplePayload(sourceType: string, sourceName: string): Record<string, unknown> {
  switch (sourceType) {
    case 'GOOGLE_BUSINESS_PROFILE':
      return {
        externalId: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-review-1`,
        body: 'Loved the staff, but pickup took longer than expected.',
        rating: 4,
        sentiment: 0.25,
        topics: ['service', 'pickup'],
        canonicalUrl: 'https://maps.google.com/example/review/1',
        externalAuthorLabel: 'Local Guide',
        subjectType: 'location',
        subjectKey: 'flagship-store',
        subjectLabel: 'Flagship Store',
        postedAt: new Date().toISOString(),
      }
    case 'REDDIT':
      return {
        externalId: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-thread-1`,
        body: 'Has anyone else had issues with the new rewards checkout flow?',
        sentiment: -0.45,
        topics: ['checkout', 'rewards'],
        canonicalUrl: 'https://reddit.com/r/example/comments/thread-1',
        externalAuthorHandle: 'u/customer_voice',
        externalAuthorLabel: 'u/customer_voice',
        subjectType: 'product',
        subjectKey: 'rewards-checkout',
        subjectLabel: 'Rewards Checkout',
        postedAt: new Date().toISOString(),
      }
    default:
      return {
        externalId: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-sample-1`,
        body: 'Webhook-delivered external signal preview.',
        summary: 'Preview item returned by Test connection',
        sentiment: 0.1,
        topics: ['preview'],
        canonicalUrl: 'https://example.com/signals/preview-1',
        externalAuthorLabel: 'external-user',
        postedAt: new Date().toISOString(),
      }
  }
}

function buildSignalWhere(
  brandId: string,
  query: ReturnType<typeof ExternalSignalsQuerySchema.parse>,
): PrismaTypes.ExternalSignalWhereInput {
  const where: PrismaTypes.ExternalSignalWhereInput = { brandId }

  if (query.sourceType) where.sourceType = query.sourceType
  if (query.matchStatus) where.matchStatus = query.matchStatus
  if (query.resolved === 'true') where.memberId = { not: null }
  if (query.resolved === 'false') where.memberId = null
  if (query.ratingMin !== undefined || query.ratingMax !== undefined) {
    where.rating = {
      gte: query.ratingMin,
      lte: query.ratingMax,
    }
  }
  if (query.sentimentMin !== undefined || query.sentimentMax !== undefined) {
    where.sentiment = {
      gte: query.sentimentMin,
      lte: query.sentimentMax,
    }
  }
  if (query.subjectKey) where.subjectKey = query.subjectKey
  if (query.search) {
    where.OR = [
      { body: { contains: query.search, mode: 'insensitive' } },
      { summary: { contains: query.search, mode: 'insensitive' } },
      { externalAuthorLabel: { contains: query.search, mode: 'insensitive' } },
      { subjectLabel: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  if (query.startDate || query.endDate) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined
    const endDate = query.endDate ? new Date(query.endDate) : undefined
    if (!where.AND) where.AND = []
    ;(where.AND as Prisma.ExternalSignalWhereInput[]).push({
      OR: [
        {
          postedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          postedAt: null,
          ingestedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      ],
    })
  }

  return where
}

function toNullableJsonInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

const externalSignalsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/external-signal-sources', async (request, reply) => {
    const query = ExternalSignalSourceListQuerySchema.parse(request.query)
    const where: Prisma.ExternalSignalSourceWhereInput = {
      brandId: request.brandId,
    }
    if (query.sourceType) where.sourceType = query.sourceType
    if (query.enabled !== undefined) where.enabled = query.enabled

    const [sources, total] = await Promise.all([
      fastify.prisma.externalSignalSource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.externalSignalSource.count({ where }),
    ])

    return reply.status(200).send({
      data: sources.map((source) => ({
        ...source,
        webhookPath: `/v1/integrations/webhooks/external-signals/${source.id}`,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    })
  })

  fastify.post('/admin/external-signal-sources', async (request, reply) => {
    const input = CreateExternalSignalSourceSchema.parse(request.body)
    const source = await fastify.prisma.externalSignalSource.create({
      data: {
        brandId: request.brandId,
        name: input.name,
        sourceType: input.sourceType,
        connectionMethod: input.connectionMethod,
        syncMode: input.syncMode,
        enabled: input.enabled,
        scopeConfig: input.scopeConfig as Prisma.InputJsonValue,
        filterConfig: toNullableJsonInput(input.filterConfig),
        matchingConfig: toNullableJsonInput(input.matchingConfig),
        credentialRef: input.credentialRef,
      },
    })

    fastify.log.info(
      { brandId: request.brandId, sourceId: source.id, sourceType: source.sourceType },
      'external_source.created',
    )

    return reply.status(201).send({
      ...source,
      webhookPath: `/v1/integrations/webhooks/external-signals/${source.id}`,
    })
  })

  fastify.patch<{ Params: { id: string } }>(
    '/admin/external-signal-sources/:id',
    async (request, reply) => {
      const input = UpdateExternalSignalSourceSchema.parse(request.body)
      const existing = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'External signal source not found' })
      }

      const updateData: PrismaTypes.ExternalSignalSourceUpdateInput = {
        name: input.name,
        sourceType: input.sourceType,
        connectionMethod: input.connectionMethod,
        syncMode: input.syncMode,
        enabled: input.enabled,
        credentialRef: input.credentialRef,
      }
      if (input.scopeConfig !== undefined) {
        updateData.scopeConfig = input.scopeConfig as Prisma.InputJsonValue
      }
      if (input.filterConfig !== undefined) {
        updateData.filterConfig = toNullableJsonInput(input.filterConfig)
      }
      if (input.matchingConfig !== undefined) {
        updateData.matchingConfig = toNullableJsonInput(input.matchingConfig)
      }

      const source = await fastify.prisma.externalSignalSource.update({
        where: { id: request.params.id },
        data: updateData,
      })

      return reply.status(200).send({
        ...source,
        webhookPath: `/v1/integrations/webhooks/external-signals/${source.id}`,
      })
    },
  )

  fastify.delete<{ Params: { id: string } }>(
    '/admin/external-signal-sources/:id',
    async (request, reply) => {
      const existing = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'External signal source not found' })
      }

      await fastify.prisma.externalSignal.deleteMany({
        where: { sourceId: request.params.id },
      })
      await fastify.prisma.externalSignalSource.delete({
        where: { id: request.params.id },
      })

      fastify.log.info(
        { brandId: request.brandId, sourceId: request.params.id },
        'external_source.deleted',
      )

      return reply.status(200).send({ message: 'Source deleted' })
    },
  )

  fastify.post<{ Params: { id: string } }>(
    '/admin/external-signal-sources/:id/test',
    async (request, reply) => {
      const input = TestExternalSignalSourceSchema.parse(request.body ?? {})
      const source = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
      })

      if (!source) {
        return reply.status(404).send({ error: 'External signal source not found' })
      }

      const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>

      // If a native connector is registered for this sourceType and no override samples
      // were provided, call the real connector for a live preview (without persisting).
      if (!input.samplePayloads || input.samplePayloads.length === 0) {
        try {
          const { CONNECTORS } = await import('@customerEQ/connectors')
          const connector = CONNECTORS[source.sourceType]
          if (connector) {
            const result = await connector({
              sourceId: source.id,
              brandId: request.brandId,
              scopeConfig,
              lastCursor: null, // always start fresh for preview
              credentialRef: source.credentialRef,
            })
            const samples = result.deliveries
              .slice(0, 5)
              .map((record) => normalizeExternalSignalCandidate(record))

            fastify.log.info(
              { brandId: request.brandId, sourceId: source.id, sampleCount: samples.length, live: true },
              'external_source.tested',
            )

            return reply.status(200).send({ success: true, samples, live: true })
          }
        } catch (err) {
          fastify.log.warn(
            { sourceId: source.id, err: err instanceof Error ? err.message : String(err) },
            'external_source.test_connector_failed',
          )
          return reply.status(200).send({
            success: false,
            error: err instanceof Error ? err.message : 'Connector test failed',
            samples: [],
          })
        }
      }

      // Fallback for generic webhook/API sources: use configured samplePayloads or hardcoded preview
      const configuredSamples = Array.isArray(scopeConfig.samplePayloads)
        ? scopeConfig.samplePayloads
        : Array.isArray(scopeConfig.seedSignals)
          ? scopeConfig.seedSignals
          : []
      const deliveries =
        input.samplePayloads && input.samplePayloads.length > 0
          ? input.samplePayloads
          : configuredSamples.length > 0
            ? configuredSamples
            : [buildSamplePayload(source.sourceType, source.name)]

      const samples = extractExternalSignalDeliveries(deliveries).map((record) =>
        normalizeExternalSignalCandidate(record),
      )

      fastify.log.info(
        { brandId: request.brandId, sourceId: source.id, sampleCount: samples.length },
        'external_source.tested',
      )

      return reply.status(200).send({
        success: true,
        samples,
      })
    },
  )

  fastify.post<{ Params: { id: string } }>(
    '/admin/external-signal-sources/:id/sync',
    async (request, reply) => {
      const source = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
        select: { id: true },
      })

      if (!source) {
        return reply.status(404).send({ error: 'External signal source not found' })
      }

      const job = await enqueueExternalSignalSync({
        brandId: request.brandId,
        sourceId: source.id,
        triggeredBy: request.clerkUserId,
        reason: 'manual',
      })

      return reply.status(202).send({
        message: 'Source sync queued',
        jobId: job.id ?? 'inline',
      })
    },
  )

  fastify.get('/admin/external-signals', async (request, reply) => {
    const query = ExternalSignalsQuerySchema.parse(request.query)
    const where = buildSignalWhere(request.brandId, query)

    const [signals, total] = await Promise.all([
      fastify.prisma.externalSignal.findMany({
        where,
        include: {
          source: { select: { id: true, name: true } },
        },
        orderBy: [{ postedAt: 'desc' }, { ingestedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.externalSignal.count({ where }),
    ])

    return reply.status(200).send({
      data: signals.map((signal) => ({
        id: signal.id,
        sourceId: signal.sourceId,
        sourceName: signal.source.name,
        sourceType: signal.sourceType,
        matchStatus: signal.matchStatus,
        matchConfidence: signal.matchConfidence,
        body: signal.body,
        summary: signal.summary,
        rating: signal.rating,
        sentiment: signal.sentiment,
        topics: signal.topics,
        canonicalUrl: signal.canonicalUrl,
        externalAuthorLabel: signal.externalAuthorLabel,
        subjectLabel: signal.subjectLabel,
        postedAt: signal.postedAt,
        memberId: signal.memberId,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    })
  })
}

export default externalSignalsRoutes
