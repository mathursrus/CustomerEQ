import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  CreateCxPlaybookSchema,
  UpdateCxPlaybookSchema,
  validateRuleOverlap,
} from '@customerEQ/shared'

const cxPlaybooksRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/cx-playbooks — create a new playbook
  fastify.post('/cx-playbooks', async (request, reply) => {
    const parse = CreateCxPlaybookSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const { name, surveyType, rules } = parse.data
    const brandId = request.brandId

    const duplicate = await fastify.prisma.cxPlaybook.findFirst({
      where: {
        brandId,
        name,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (duplicate) {
      return reply.status(422).send({
        error: 'Conflict',
        message: `A playbook named "${name}" already exists for this brand`,
      })
    }

    // Validate no overlapping score ranges
    const overlapErrors = validateRuleOverlap(rules)
    if (overlapErrors.length > 0) {
      return reply.status(422).send({
        error: 'Rule overlap',
        message: 'Score ranges must not overlap between rules',
        overlaps: overlapErrors,
      })
    }

    try {
      const playbook = await fastify.prisma.cxPlaybook.create({
        data: {
          brandId,
          name,
          surveyType,
          rules: rules as unknown as Prisma.InputJsonValue,
        },
      })
      return reply.status(201).send(playbook)
    } catch (err: unknown) {
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') {
        return reply.status(422).send({
          error: 'Conflict',
          message: `A playbook named "${name}" already exists for this brand`,
        })
      }
      throw err
    }
  })

  // GET /v1/cx-playbooks — list playbooks for brand (optionally filtered by surveyType)
  fastify.get('/cx-playbooks', async (request, reply) => {
    const { surveyType } = request.query as { surveyType?: string }
    const brandId = request.brandId

    const where: Record<string, unknown> = { brandId, deletedAt: null }
    if (surveyType) {
      where.surveyType = surveyType
    }

    const data = await fastify.prisma.cxPlaybook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return reply.status(200).send({ data, total: data.length })
  })

  // PUT /v1/cx-playbooks/:id — update playbook name and/or rules
  fastify.put('/cx-playbooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const parse = UpdateCxPlaybookSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    // Verify ownership and existence
    const existing = await fastify.prisma.cxPlaybook.findFirst({
      where: { id, brandId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Playbook not found' })
    }

    const { name, rules } = parse.data

    if (name !== undefined) {
      const duplicate = await fastify.prisma.cxPlaybook.findFirst({
        where: {
          brandId,
          name,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      })
      if (duplicate) {
        return reply.status(422).send({
          error: 'Conflict',
          message: `A playbook named "${name}" already exists for this brand`,
        })
      }
    }

    // Validate rule overlap if rules are being updated
    if (rules) {
      const overlapErrors = validateRuleOverlap(rules)
      if (overlapErrors.length > 0) {
        return reply.status(422).send({
          error: 'Rule overlap',
          message: 'Score ranges must not overlap between rules',
          overlaps: overlapErrors,
        })
      }
    }

    try {
      const updated = await fastify.prisma.cxPlaybook.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(rules !== undefined && { rules: rules as unknown as Prisma.InputJsonValue }),
        },
      })
      return reply.status(200).send(updated)
    } catch (err: unknown) {
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') {
        return reply.status(422).send({
          error: 'Conflict',
          message: `A playbook named "${name}" already exists for this brand`,
        })
      }
      throw err
    }
  })

  // DELETE /v1/cx-playbooks/:id — soft-delete playbook
  fastify.delete('/cx-playbooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const brandId = request.brandId

    const existing = await fastify.prisma.cxPlaybook.findFirst({
      where: { id, brandId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Playbook not found' })
    }

    await fastify.prisma.cxPlaybook.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return reply.status(204).send()
  })
}

export default cxPlaybooksRoutes
