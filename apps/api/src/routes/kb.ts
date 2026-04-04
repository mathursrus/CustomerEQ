import type { FastifyPluginAsync } from 'fastify'
import {
  CreateKBArticleSchema,
  UpdateKBArticleSchema,
  KBSearchQuerySchema,
} from '@customerEQ/shared'
import { generateEmbedding } from '@customerEQ/ai'
import { enqueueEmbeddingGeneration } from '../queues/bullmq.js'
import pino from 'pino'

const log = pino({ name: 'kb-routes' })

const kbRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/kb/articles — create a new KB article
  fastify.post('/kb/articles', async (request, reply) => {
    const parse = CreateKBArticleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId
    const { title, body, category, tags, status } = parse.data

    const article = await fastify.prisma.kBArticle.create({
      data: { brandId, title, body, category, tags, status },
    })

    // Enqueue embedding generation
    await enqueueEmbeddingGeneration({
      articleId: article.id,
      brandId,
      text: `${title}\n\n${body}`,
    })

    // Audit event
    await fastify.prisma.auditEvent.create({
      data: {
        brandId,
        actorId: (request as unknown as { auth: { userId: string } }).auth.userId,
        action: 'kb_article.create',
        resourceType: 'KBArticle',
        resourceId: article.id,
        metadata: { title: article.title, category: article.category },
      },
    })

    log.info({ brandId, articleId: article.id, action: 'create', category }, 'KB article created')
    return reply.status(201).send(article)
  })

  // GET /v1/kb/articles — list KB articles (paginated, filterable)
  fastify.get('/kb/articles', async (request, reply) => {
    const query = request.query as { page?: string; pageSize?: string; category?: string; status?: string }
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '25', 10) || 25))
    const brandId = request.brandId

    const where: Record<string, unknown> = { brandId, deletedAt: null }
    if (query.category) where.category = query.category
    if (query.status) where.status = query.status

    const [total, data] = await Promise.all([
      fastify.prisma.kBArticle.count({ where }),
      fastify.prisma.kBArticle.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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

  // GET /v1/kb/articles/:id — get single KB article
  fastify.get('/kb/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const article = await fastify.prisma.kBArticle.findFirst({
      where: { id, brandId, deletedAt: null },
    })

    if (!article) {
      return reply.status(404).send({ error: 'Article not found' })
    }

    return reply.status(200).send(article)
  })

  // PUT /v1/kb/articles/:id — update KB article
  fastify.put('/kb/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const parse = UpdateKBArticleSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    // Verify article exists and belongs to this brand
    const existing = await fastify.prisma.kBArticle.findFirst({
      where: { id, brandId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Article not found' })
    }

    const article = await fastify.prisma.kBArticle.update({
      where: { id },
      data: parse.data,
    })

    // Re-generate embedding if title or body changed
    if (parse.data.title || parse.data.body) {
      await enqueueEmbeddingGeneration({
        articleId: article.id,
        brandId,
        text: `${article.title}\n\n${article.body}`,
      })
    }

    // Audit event
    await fastify.prisma.auditEvent.create({
      data: {
        brandId,
        actorId: (request as unknown as { auth: { userId: string } }).auth.userId,
        action: 'kb_article.update',
        resourceType: 'KBArticle',
        resourceId: article.id,
        metadata: { title: article.title, category: article.category },
      },
    })

    log.info({ brandId, articleId: article.id, action: 'update', category: article.category }, 'KB article updated')
    return reply.status(200).send(article)
  })

  // DELETE /v1/kb/articles/:id — soft-delete KB article
  fastify.delete('/kb/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const existing = await fastify.prisma.kBArticle.findFirst({
      where: { id, brandId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Article not found' })
    }

    await fastify.prisma.kBArticle.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // Audit event
    await fastify.prisma.auditEvent.create({
      data: {
        brandId,
        actorId: (request as unknown as { auth: { userId: string } }).auth.userId,
        action: 'kb_article.delete',
        resourceType: 'KBArticle',
        resourceId: id,
        metadata: { title: existing.title },
      },
    })

    log.info({ brandId, articleId: id, action: 'delete' }, 'KB article soft-deleted')
    return reply.status(204).send()
  })

  // GET /v1/kb/search — semantic search
  fastify.get('/kb/search', async (request, reply) => {
    const parse = KBSearchQuerySchema.safeParse(request.query)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const { q, limit } = parse.data
    const brandId = request.brandId
    const startMs = Date.now()

    // Generate embedding for the query
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(q)
    } catch (err) {
      log.error({ err, brandId, query: q }, 'Failed to generate query embedding')
      return reply.status(502).send({ error: 'Failed to generate search embedding' })
    }

    // Convert to pgvector format: [0.1,0.2,...]
    const vectorStr = `[${queryEmbedding.join(',')}]`

    // Raw SQL for cosine similarity search via pgvector
    const results = await fastify.prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; category: string; body: string; score: number }>
    >(
      `SELECT id, title, category, body,
              1 - (embedding <=> $1::vector) AS score
       FROM kb_articles
       WHERE "brandId" = $2
         AND status = 'PUBLISHED'
         AND "deletedAt" IS NULL
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      brandId,
      limit,
    )

    // Add snippet (first 200 chars of body)
    const data = results.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      score: Number(r.score),
      snippet: r.body.length > 200 ? r.body.slice(0, 200) + '...' : r.body,
    }))

    const latencyMs = Date.now() - startMs
    log.info({ brandId, query: q, resultCount: data.length, latencyMs }, 'Semantic search')

    return reply.status(200).send({ data, total: data.length })
  })
}

export default kbRoutes
