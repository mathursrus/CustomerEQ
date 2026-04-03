import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  CreateProgramSchema,
  UpdateProgramSchema,
  UpdateProgramStatusSchema,
  SimulateSchema,
  CreateTierSchema,
  RetireRewardSchema,
  evaluateConditions,
} from '@customerEQ/shared'
import type { ConditionGroup } from '@customerEQ/shared'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Local schemas (not in @customerEQ/shared)
// ---------------------------------------------------------------------------

const CreateEarningRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  triggerEvent: z.string().min(1, 'triggerEvent is required'),
  pointsAwarded: z.number().int().nonnegative(),
  multiplier: z.number().positive().optional().default(1.0),
  conditions: z.record(z.unknown()).optional(),
  maxUsesPerMember: z.number().int().positive().optional(),
  priority: z.number().int().min(0).optional().default(0),
  stackable: z.boolean().optional().default(false),
  budgetCapPoints: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
})

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  type: z.enum(['POINTS', 'TIERED', 'CASHBACK', 'HYBRID']).optional(),
  search: z.string().optional(),
})

const programsRoutes: FastifyPluginAsync = async (fastify) => {

  // -------------------------------------------------------------------------
  // GET /v1/programs — paginated list with filters
  // -------------------------------------------------------------------------
  fastify.get('/programs', async (request, reply) => {
    const parse = PaginationSchema.safeParse(request.query)
    if (!parse.success) {
      return reply.status(422).send({ error: 'Validation failed', details: parse.error.errors })
    }
    const { page, pageSize, status, type, search } = parse.data

    const where: Prisma.ProgramWhereInput = {
      brandId: request.brandId,
      deletedAt: null,
      ...(status && { status }),
      ...(type && { type }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    }

    const [total, data] = await Promise.all([
      fastify.prisma.program.count({ where }),
      fastify.prisma.program.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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

  // -------------------------------------------------------------------------
  // POST /v1/programs
  // -------------------------------------------------------------------------
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
        type: data.type,
        pointCurrencyName: data.pointCurrencyName,
        pointToCurrencyRatio: data.pointToCurrencyRatio,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        budgetUsdCents: data.budgetUsdCents,
        monthlyBudgetUsdCents: data.monthlyBudgetUsdCents,
        alertThresholdPct: data.alertThresholdPct,
        haltBehavior: data.haltBehavior,
        status: 'DRAFT',
      },
    })

    await fastify.prisma.auditEvent.create({
      data: {
        brandId: request.brandId,
        actorId: request.clerkUserId,
        action: 'program.create',
        resourceType: 'Program',
        resourceId: program.id,
      },
    })

    return reply.status(201).send(program)
  })

  // -------------------------------------------------------------------------
  // GET /v1/programs/:id — includes tiers (sorted by rank) + rewards
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>('/programs/:id', async (request, reply) => {
    const program = await fastify.prisma.program.findFirst({
      where: {
        id: request.params.id,
        brandId: request.brandId,
        deletedAt: null,
      },
      include: {
        earningRules: { where: { status: 'ACTIVE' }, orderBy: { priority: 'asc' } },
        tiers: { where: { deletedAt: null }, orderBy: { rank: 'asc' } },
        rewards: { where: { deletedAt: null } },
      },
    })

    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    return reply.status(200).send(program)
  })

  // -------------------------------------------------------------------------
  // PATCH /v1/programs/:id
  // -------------------------------------------------------------------------
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
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Program not found' })
      }

      const data = parse.data

      if (data.status === 'ACTIVE') {
        const ruleCount = await fastify.prisma.earningRule.count({
          where: { programId: existing.id, brandId: request.brandId, status: 'ACTIVE' },
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
          ...(data.pointCurrencyName !== undefined && { pointCurrencyName: data.pointCurrencyName }),
          ...(data.pointToCurrencyRatio !== undefined && { pointToCurrencyRatio: data.pointToCurrencyRatio }),
          ...(data.status !== undefined && { status: data.status }),
        },
      })

      return reply.status(200).send(updated)
    },
  )

  // -------------------------------------------------------------------------
  // PUT /v1/programs/:id/status — dedicated status transition endpoint
  // -------------------------------------------------------------------------
  fastify.put<{ Params: { id: string } }>(
    '/programs/:id/status',
    async (request, reply) => {
      const parse = UpdateProgramStatusSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          details: parse.error.errors,
        })
      }

      const existing = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Program not found' })
      }

      const { status } = parse.data

      if (status === 'ACTIVE') {
        const ruleCount = await fastify.prisma.earningRule.count({
          where: { programId: existing.id, brandId: request.brandId, status: 'ACTIVE' },
        })
        if (ruleCount === 0) {
          return reply.status(422).send({
            error: 'At least one earning rule is required to activate a program.',
          })
        }
      }

      const updated = await fastify.prisma.program.update({
        where: { id: request.params.id },
        data: { status },
      })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'program.status_change',
          resourceType: 'Program',
          resourceId: updated.id,
          metadata: { from: existing.status, to: status },
        },
      })

      return reply.status(200).send(updated)
    },
  )

  // -------------------------------------------------------------------------
  // POST /v1/programs/:id/rules
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/programs/:id/rules',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
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
          priority: data.priority,
          stackable: data.stackable,
          budgetCapPoints: data.budgetCapPoints ?? undefined,
          validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
          validTo: data.validTo ? new Date(data.validTo) : undefined,
          status: 'ACTIVE',
        },
      })

      return reply.status(201).send(rule)
    },
  )

  // -------------------------------------------------------------------------
  // Tier CRUD
  // -------------------------------------------------------------------------

  fastify.post<{ Params: { id: string } }>(
    '/programs/:id/tiers',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      })
      if (!program) return reply.status(404).send({ error: 'Program not found' })

      const parse = CreateTierSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'Validation failed', details: parse.error.errors })
      }

      const tier = await fastify.prisma.tier.create({
        data: {
          brandId: request.brandId,
          programId: program.id,
          name: parse.data.name,
          rank: parse.data.rank,
          icon: parse.data.icon,
          minPoints: parse.data.minPoints,
          minSpendCents: parse.data.minSpendCents,
          benefits: parse.data.benefits,
          multiplier: parse.data.multiplier,
        },
      })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'tier.create',
          resourceType: 'Tier',
          resourceId: tier.id,
        },
      })

      return reply.status(201).send(tier)
    },
  )

  fastify.delete<{ Params: { id: string; tierId: string } }>(
    '/programs/:id/tiers/:tierId',
    async (request, reply) => {
      const tier = await fastify.prisma.tier.findFirst({
        where: {
          id: request.params.tierId,
          programId: request.params.id,
          brandId: request.brandId,
          deletedAt: null,
        },
      })
      if (!tier) return reply.status(404).send({ error: 'Tier not found' })

      // Block deletion if members are currently in this tier
      const memberCount = await fastify.prisma.member.count({
        where: { currentTierId: tier.id },
      })
      if (memberCount > 0) {
        return reply.status(409).send({
          error: `Cannot delete tier: ${memberCount} member(s) currently assigned to this tier`,
        })
      }

      await fastify.prisma.tier.update({
        where: { id: tier.id },
        data: { deletedAt: new Date() },
      })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'tier.delete',
          resourceType: 'Tier',
          resourceId: tier.id,
        },
      })

      return reply.status(200).send({ id: tier.id, deleted: true })
    },
  )

  // -------------------------------------------------------------------------
  // Reward retire — DELETE /v1/programs/:id/rewards/:rwId
  // -------------------------------------------------------------------------

  fastify.delete<{ Params: { id: string; rwId: string } }>(
    '/programs/:id/rewards/:rwId',
    async (request, reply) => {
      const reward = await fastify.prisma.reward.findFirst({
        where: {
          id: request.params.rwId,
          programId: request.params.id,
          brandId: request.brandId,
          deletedAt: null,
        },
      })
      if (!reward) return reply.status(404).send({ error: 'Reward not found' })

      const parse = RetireRewardSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'Validation failed', details: parse.error.errors })
      }

      const { expireAt } = parse.data

      let updated: Awaited<ReturnType<typeof fastify.prisma.reward.update>>

      if (expireAt) {
        // Scheduled retire: set availableTo to the future date
        updated = await fastify.prisma.reward.update({
          where: { id: reward.id },
          data: { availableTo: new Date(expireAt) },
        })
      } else {
        // Immediate retire: set isAvailable=false
        updated = await fastify.prisma.reward.update({
          where: { id: reward.id },
          data: { isAvailable: false },
        })
      }

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'reward.retire',
          resourceType: 'Reward',
          resourceId: reward.id,
          metadata: { expireAt: expireAt ?? null },
        },
      })

      return reply.status(200).send(updated)
    },
  )

  // -------------------------------------------------------------------------
  // POST /v1/programs/:id/simulate — dry run, no DB writes
  // -------------------------------------------------------------------------

  fastify.post<{ Params: { id: string } }>(
    '/programs/:id/simulate',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      })
      if (!program) return reply.status(404).send({ error: 'Program not found' })

      const parse = SimulateSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'Validation failed', details: parse.error.errors })
      }

      const { eventType, payload } = parse.data

      const rules = await fastify.prisma.earningRule.findMany({
        where: { programId: program.id, brandId: request.brandId, status: 'ACTIVE' },
        orderBy: { priority: 'asc' },
      })

      // Evaluate conditions and fire matching rules (first-match-wins, stackable opt-in)
      let firstMatchSeen = false
      const rulesMatched: Array<{ ruleId: string; ruleName: string; points: number }> = []

      for (const rule of rules) {
        if (rule.triggerEvent !== eventType) continue
        if (firstMatchSeen && !rule.stackable) continue
        if (rule.budgetCapPoints !== null && rule.budgetUsedPoints >= rule.budgetCapPoints) continue

        const conditionGroup = rule.conditions as ConditionGroup | null

        if (!evaluateConditions(conditionGroup, payload)) continue

        const points = Math.round(rule.pointsAwarded * rule.multiplier)
        rulesMatched.push({ ruleId: rule.id, ruleName: rule.name, points })

        if (!rule.stackable) firstMatchSeen = true
      }

      const totalPoints = rulesMatched.reduce((sum, r) => sum + r.points, 0)

      return reply.status(200).send({ rulesMatched, totalPoints, dry_run: true })
    },
  )

  // -------------------------------------------------------------------------
  // ProgramVersions — POST /v1/programs/:id/versions + GET /v1/programs/:id/versions
  // -------------------------------------------------------------------------

  fastify.post<{ Params: { id: string } }>(
    '/programs/:id/versions',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
        include: {
          earningRules: { where: { status: 'ACTIVE' } },
          tiers: { where: { deletedAt: null }, orderBy: { rank: 'asc' } },
          rewards: { where: { deletedAt: null } },
        },
      })
      if (!program) return reply.status(404).send({ error: 'Program not found' })

      const version = await fastify.prisma.programVersion.create({
        data: {
          brandId: request.brandId,
          programId: program.id,
          snapshot: program as unknown as Prisma.InputJsonValue,
          source: 'explicit_save',
        },
      })

      await fastify.prisma.auditEvent.create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId,
          action: 'program.version_create',
          resourceType: 'ProgramVersion',
          resourceId: version.id,
        },
      })

      return reply.status(201).send(version)
    },
  )

  fastify.get<{ Params: { id: string } }>(
    '/programs/:id/versions',
    async (request, reply) => {
      const program = await fastify.prisma.program.findFirst({
        where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      })
      if (!program) return reply.status(404).send({ error: 'Program not found' })

      const versions = await fastify.prisma.programVersion.findMany({
        where: { programId: program.id, brandId: request.brandId },
        orderBy: { createdAt: 'desc' },
      })

      return reply.status(200).send({ data: versions })
    },
  )
}

export default programsRoutes
