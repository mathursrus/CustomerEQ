import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { CreateProgramSchema, UpdateProgramSchema } from '@customerEQ/shared'
import { z } from 'zod'

const CreateEarningRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  triggerEvent: z.string().min(1, 'triggerEvent is required'),
  pointsAwarded: z.number().int().nonnegative(),
  multiplier: z.number().positive().optional().default(1.0),
  conditions: z.record(z.unknown()).optional(),
  maxUsesPerMember: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
})

const programsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/programs
  fastify.post('/programs', async (request, reply) => {
    const parse = CreateProgramSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data
    const program = await fastify.prisma.program.create({
      data: {
        brandId: request.brandId,
        name: data.name,
        description: data.description,
        pointCurrencyName: data.pointCurrencyName,
        pointToCurrencyRatio: data.pointToCurrencyRatio,
        status: 'DRAFT',
      },
    })

    return reply.status(201).send(program)
  })

  // GET /v1/programs/:id
  fastify.get<{ Params: { id: string } }>('/programs/:id', async (request, reply) => {
    const program = await fastify.prisma.program.findFirst({
      where: {
        id: request.params.id,
        brandId: request.brandId,
      },
      include: {
        earningRules: true,
      },
    })

    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    return reply.status(200).send(program)
  })

  // PATCH /v1/programs/:id
  fastify.patch<{ Params: { id: string } }>(
    '/programs/:id',
    async (request, reply) => {
      const parse = UpdateProgramSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const existing = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Program not found' })
      }

      const data = parse.data

      // If activating, require at least one earning rule
      if (data.status === 'ACTIVE') {
        const ruleCount = await fastify.prisma.earningRule.count({
          where: { programId: existing.id, brandId: request.brandId },
        })
        if (ruleCount === 0) {
          return reply.status(422).send({
            error: 'At least one earning rule is required to activate a program.',
          })
        }
      }

      const updated = await fastify.prisma.program.update({
        where: { id: request.params.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.pointCurrencyName !== undefined && {
            pointCurrencyName: data.pointCurrencyName,
          }),
          ...(data.pointToCurrencyRatio !== undefined && {
            pointToCurrencyRatio: data.pointToCurrencyRatio,
          }),
          ...(data.status !== undefined && { status: data.status }),
        },
      })

      return reply.status(200).send(updated)
    },
  )

  // POST /v1/programs/:id/rules
  fastify.post<{ Params: { id: string } }>(
    '/programs/:id/rules',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId },
      })

      if (!program) {
        return reply.status(404).send({ error: 'Program not found' })
      }

      const parse = CreateEarningRuleSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const data = parse.data
      const rule = await fastify.prisma.earningRule.create({
        data: {
          brandId: request.brandId,
          programId: program.id,
          name: data.name,
          triggerEvent: data.triggerEvent,
          pointsAwarded: data.pointsAwarded,
          multiplier: data.multiplier,
          conditions: (data.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
          maxUsesPerMember: data.maxUsesPerMember ?? undefined,
          validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
          validTo: data.validTo ? new Date(data.validTo) : undefined,
          status: 'ACTIVE',
        },
      })

      return reply.status(201).send(rule)
    },
  )
}

export default programsRoutes
