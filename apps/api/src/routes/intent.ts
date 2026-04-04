import type { FastifyPluginAsync } from 'fastify'
import { ClassifyIntentSchema } from '@customerEQ/shared'
import { classifyIntent } from '@customerEQ/ai'
import pino from 'pino'

const log = pino({ name: 'intent-routes' })

const intentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/classify-intent — classify customer message intent
  fastify.post('/classify-intent', async (request, reply) => {
    const parse = ClassifyIntentSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const brandId = request.brandId
    const startMs = Date.now()

    // Fetch published KB article summaries for this brand
    const articles = await fastify.prisma.kBArticle.findMany({
      where: { brandId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, category: true },
    })

    const kbSummaries = articles.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
    }))

    let result
    try {
      result = await classifyIntent(parse.data.text, kbSummaries)
    } catch (err) {
      log.error({ err, brandId }, 'Intent classification failed')
      return reply.status(502).send({ error: 'Intent classification failed' })
    }

    // Filter suggested article IDs to only include valid, existing articles
    const validIds = new Set(articles.map((a) => a.id))
    result.suggested_article_ids = result.suggested_article_ids.filter(
      (id: string) => validIds.has(id),
    )

    const latencyMs = Date.now() - startMs
    log.info(
      {
        brandId,
        intent: result.primary_intent,
        confidence: result.confidence,
        urgency: result.urgency,
        articleSuggestions: result.suggested_article_ids.length,
        latencyMs,
      },
      'Intent classified',
    )

    return reply.status(200).send(result)
  })
}

export default intentRoutes
