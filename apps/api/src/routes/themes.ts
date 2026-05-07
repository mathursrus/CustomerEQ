import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateBrandThemeSchema, UpdateBrandThemeSchema } from '@customerEQ/shared'

const themesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/themes — list all themes for the brand
  fastify.get('/themes', async (request, reply) => {
    const brandId = request.brandId
    const [brand, themes] = await Promise.all([
      fastify.prisma.brand.findUnique({
        where: { id: brandId },
        select: { defaultThemeId: true },
      }),
      fastify.prisma.brandTheme.findMany({
        where: { brandId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { surveys: true } } },
      }),
    ])
    const defaultThemeId = brand?.defaultThemeId ?? null
    const decorated = themes.map((t: { id: string }) => ({ ...t, isDefault: t.id === defaultThemeId }))
    return reply.status(200).send({ themes: decorated, defaultThemeId })
  })

  // POST /v1/themes — create a new theme
  fastify.post('/themes', async (request, reply) => {
    const parse = CreateBrandThemeSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId

    const theme = await fastify.prisma.brandTheme.create({
      data: {
        brandId,
        ...parse.data,
      } as Prisma.BrandThemeUncheckedCreateInput,
    })

    return reply.status(201).send({ ...theme, isDefault: false })
  })

  // GET /v1/themes/:id — get theme details
  fastify.get('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId
    const [brand, theme] = await Promise.all([
      fastify.prisma.brand.findUnique({
        where: { id: brandId },
        select: { defaultThemeId: true },
      }),
      fastify.prisma.brandTheme.findFirst({
        where: { id, brandId },
        include: { _count: { select: { surveys: true } } },
      }),
    ])
    if (!theme) return reply.status(404).send({ error: 'Theme not found' })
    return reply.status(200).send({ ...theme, isDefault: brand?.defaultThemeId === theme.id })
  })

  // PATCH /v1/themes/:id — update a theme
  fastify.patch('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateBrandThemeSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const existing = await fastify.prisma.brandTheme.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!existing) return reply.status(404).send({ error: 'Theme not found' })

    const updated = await fastify.prisma.brandTheme.update({
      where: { id },
      data: parse.data as Prisma.BrandThemeUpdateInput,
    })

    const brand = await fastify.prisma.brand.findUnique({
      where: { id: request.brandId },
      select: { defaultThemeId: true },
    })

    return reply.status(200).send({ ...updated, isDefault: brand?.defaultThemeId === updated.id })
  })

  // DELETE /v1/themes/:id — delete a theme (fails if in use by active surveys)
  fastify.delete('/themes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const theme = await fastify.prisma.brandTheme.findFirst({
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

    await fastify.prisma.brandTheme.delete({ where: { id } })
    return reply.status(204).send()
  })

  // POST /v1/themes/:id/default — set as brand default
  fastify.post('/themes/:id/default', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const theme = await fastify.prisma.brandTheme.findFirst({
      where: { id, brandId },
    })
    if (!theme) return reply.status(404).send({ error: 'Theme not found' })

    // Issue #291 — single statement: write Brand.defaultThemeId.
    // Replaces the previous updateMany-clear-then-update-set sequence on
    // SurveyTheme.isDefault. The boolean column is gone.
    await fastify.prisma.brand.update({
      where: { id: brandId },
      data: { defaultThemeId: id },
    })

    return reply.status(200).send({ ...theme, isDefault: true })
  })
}

export default themesRoutes
