import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateSurveyThemeSchema, UpdateSurveyThemeSchema } from '@customerEQ/shared'

const themesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/themes — list all themes for the brand
  fastify.get('/themes', async (request, reply) => {
    const themes = await fastify.prisma.surveyTheme.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { surveys: true } } },
    })
    return reply.status(200).send({ themes })
  })

  // POST /v1/themes — create a new theme
  fastify.post('/themes', async (request, reply) => {
    const parse = CreateSurveyThemeSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId
    const data = parse.data

    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await fastify.prisma.surveyTheme.updateMany({
        where: { brandId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const theme = await fastify.prisma.surveyTheme.create({
      data: {
        brandId,
        ...data,
      } as Prisma.SurveyThemeUncheckedCreateInput,
    })

    return reply.status(201).send(theme)
  })

  // GET /v1/themes/:id — get theme details
  fastify.get('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const theme = await fastify.prisma.surveyTheme.findFirst({
      where: { id, brandId: request.brandId },
      include: { _count: { select: { surveys: true } } },
    })
    if (!theme) return reply.status(404).send({ error: 'Theme not found' })
    return reply.status(200).send(theme)
  })

  // PATCH /v1/themes/:id — update a theme
  fastify.patch('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateSurveyThemeSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const existing = await fastify.prisma.surveyTheme.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Theme not found' })

    const updated = await fastify.prisma.surveyTheme.update({
      where: { id },
      data: parse.data as Prisma.SurveyThemeUpdateInput,
    })

    return reply.status(200).send(updated)
  })

  // DELETE /v1/themes/:id — delete a theme (fails if in use by active surveys)
  fastify.delete('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const theme = await fastify.prisma.surveyTheme.findFirst({
      where: { id, brandId: request.brandId },
      include: { _count: { select: { surveys: true } } },
    })
    if (!theme) return reply.status(404).send({ error: 'Theme not found' })

    if (theme._count.surveys > 0) {
      return reply.status(409).send({
        error: 'Theme is in use',
        message: `This theme is used by ${theme._count.surveys} survey(s). Remove the theme from those surveys first.`,
      })
    }

    await fastify.prisma.surveyTheme.delete({ where: { id } })
    return reply.status(204).send()
  })

  // POST /v1/themes/:id/default — set as brand default
  fastify.post('/themes/:id/default', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const theme = await fastify.prisma.surveyTheme.findFirst({
      where: { id, brandId },
    })
    if (!theme) return reply.status(404).send({ error: 'Theme not found' })

    // Unset all other defaults, then set this one
    await fastify.prisma.$transaction([
      fastify.prisma.surveyTheme.updateMany({
        where: { brandId, isDefault: true },
        data: { isDefault: false },
      }),
      fastify.prisma.surveyTheme.update({
        where: { id },
        data: { isDefault: true },
      }),
    ])

    return reply.status(200).send({ ...theme, isDefault: true })
  })
}

export default themesRoutes
