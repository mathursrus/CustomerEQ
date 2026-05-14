import type { FastifyPluginAsync } from 'fastify'
import { CreateKBSourceSchema, UpdateKBSourceSchema, QUEUES } from '@customerEQ/shared'
import { enqueueKbIngestion } from '../queues/bullmq.js'

const kbSourceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /kb/sources
  fastify.get('/kb/sources', async (request, reply) => {
    const sources = await fastify.prisma.kBSource.findMany({
      where: { brandId: request.brandId, status: { not: 'DISABLED' } as never },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ sources })
  })

  // GET /kb/sources/:id
  fastify.get<{ Params: { id: string } }>('/kb/sources/:id', async (request, reply) => {
    const source = await fastify.prisma.kBSource.findUnique({ where: { id: request.params.id } })
    if (!source || source.brandId !== request.brandId) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return reply.send(source)
  })

  // POST /kb/sources
  fastify.post('/kb/sources', async (request, reply) => {
    const parse = CreateKBSourceSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
    }
    const created = await fastify.prisma.kBSource.create({
      data: { ...parse.data, brandId: request.brandId },
    })
    await fastify.prisma.auditEvent
      .create({
        data: {
          brandId: request.brandId,
          actorId: (request as any).clerkUserId ?? 'system',
          action: 'kb_source.create',
          resourceType: 'KBSource',
          resourceId: created.id,
        },
      })
      .catch(() => undefined)
    return reply.status(201).send(created)
  })

  // PATCH /kb/sources/:id
  fastify.patch<{ Params: { id: string } }>('/kb/sources/:id', async (request, reply) => {
    const existing = await fastify.prisma.kBSource.findUnique({ where: { id: request.params.id } })
    if (!existing || existing.brandId !== request.brandId) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const parse = UpdateKBSourceSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
    }
    const updated = await fastify.prisma.kBSource.update({
      where: { id: request.params.id },
      data: parse.data,
    })
    return reply.send(updated)
  })

  // DELETE /kb/sources/:id (soft-delete via status=DISABLED)
  fastify.delete<{ Params: { id: string } }>('/kb/sources/:id', async (request, reply) => {
    const existing = await fastify.prisma.kBSource.findUnique({ where: { id: request.params.id } })
    if (!existing || existing.brandId !== request.brandId) {
      return reply.status(404).send({ error: 'Not found' })
    }
    await fastify.prisma.kBSource.update({
      where: { id: request.params.id },
      data: { status: 'DISABLED' },
    })
    return reply.status(204).send()
  })

  // POST /kb/sources/:id/crawl — enqueue ingestion job
  fastify.post<{ Params: { id: string } }>('/kb/sources/:id/crawl', async (request, reply) => {
    const source = await fastify.prisma.kBSource.findUnique({ where: { id: request.params.id } })
    if (!source || source.brandId !== request.brandId) {
      return reply.status(404).send({ error: 'Not found' })
    }
    if (source.kind === 'MANUAL') {
      return reply.status(400).send({ error: 'MANUAL sources have no crawl' })
    }
    await enqueueKbIngestion({
      sourceId: source.id,
      brandId: source.brandId,
      triggeredBy: 'MANUAL',
    })
    return reply.status(202).send({ enqueued: true })
  })
}

export default kbSourceRoutes
