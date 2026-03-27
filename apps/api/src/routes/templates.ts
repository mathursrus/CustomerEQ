import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateQuestionTemplateSchema } from '@customerEQ/shared'

const templatesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/question-templates — list templates for the brand
  fastify.get('/question-templates', async (request, reply) => {
    const templates = await fastify.prisma.questionTemplate.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.status(200).send({ templates })
  })

  // POST /v1/question-templates — create a template
  fastify.post('/question-templates', async (request, reply) => {
    const parse = CreateQuestionTemplateSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const template = await fastify.prisma.questionTemplate.create({
      data: {
        brandId: request.brandId,
        name: parse.data.name,
        question: parse.data.question as unknown as Prisma.InputJsonValue,
        tags: parse.data.tags,
      },
    })

    return reply.status(201).send(template)
  })

  // DELETE /v1/question-templates/:id — delete a template
  fastify.delete('/question-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const template = await fastify.prisma.questionTemplate.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!template) return reply.status(404).send({ error: 'Template not found' })

    await fastify.prisma.questionTemplate.delete({ where: { id } })
    return reply.status(204).send()
  })
}

export default templatesRoutes
