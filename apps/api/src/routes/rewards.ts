import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const CreateRewardSchema = z.object({
  programId: z.string().min(1, 'programId is required'),
  name: z.string().min(1, 'name is required').max(100),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().positive('pointsCost must be a positive integer'),
  stock: z.number().int().nonnegative().optional(),
  isAvailable: z.boolean().optional().default(true),
})

const rewardsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/rewards — admin creates reward
  fastify.post('/rewards', async (request, reply) => {
    const parse = CreateRewardSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const data = parse.data

    // Verify program belongs to this brand
    const program = await fastify.prisma.program.findFirst({
      where: { id: data.programId, brandId: request.brandId },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    const reward = await fastify.prisma.reward.create({
      data: {
        brandId: request.brandId,
        programId: data.programId,
        name: data.name,
        description: data.description ?? undefined,
        pointsCost: data.pointsCost,
        stock: data.stock ?? undefined,
        isAvailable: data.isAvailable,
      },
    })

    return reply.status(201).send(reward)
  })

  // GET /v1/rewards — browse available rewards
  fastify.get('/rewards', async (request, reply) => {
    const rewards = await fastify.prisma.reward.findMany({
      where: {
        brandId: request.brandId,
        isAvailable: true,
        OR: [{ stock: null }, { stock: { gt: 0 } }],
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.status(200).send({ rewards })
  })
}

export default rewardsRoutes
