import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { RedeemSchema } from '@customerEQ/shared'

const redemptionsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/redemptions — atomic redemption
  fastify.post('/redemptions', async (request, reply) => {
    const parse = RedeemSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const { rewardId, memberId } = parse.data
    const brandId = request.brandId

    try {
      const redemption = await fastify.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Lock + check member balance (scoped to brand)
        const member = await tx.member.findUnique({
          where: { id: memberId },
          select: { id: true, pointsBalance: true, brandId: true },
        })

        if (!member || member.brandId !== brandId) {
          const err = new Error('Member not found')
          ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
          throw err
        }

        // 2. Fetch reward (scoped to brand)
        const reward = await tx.reward.findUnique({
          where: { id: rewardId },
          select: {
            id: true,
            brandId: true,
            pointsCost: true,
            stock: true,
            isAvailable: true,
          },
        })

        if (!reward || reward.brandId !== brandId) {
          const err = new Error('Reward not found')
          ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
          throw err
        }

        if (!reward.isAvailable) {
          const err = new Error('Reward is no longer available.')
          ;(err as NodeJS.ErrnoException).code = 'OUT_OF_STOCK'
          throw err
        }

        if (reward.stock !== null && reward.stock <= 0) {
          const err = new Error('Reward is no longer available.')
          ;(err as NodeJS.ErrnoException).code = 'OUT_OF_STOCK'
          throw err
        }

        if (member.pointsBalance < reward.pointsCost) {
          const err = new Error('Insufficient points balance')
          ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_POINTS'
          throw err
        }

        // 3. Deduct member balance
        await tx.member.update({
          where: { id: memberId },
          data: { pointsBalance: { decrement: reward.pointsCost } },
        })

        // 4. Decrement stock if limited
        if (reward.stock !== null) {
          await tx.reward.update({
            where: { id: rewardId },
            data: { stock: { decrement: 1 } },
          })
        }

        // 5. Create LoyaltyEvent (negative points = burn)
        await tx.loyaltyEvent.create({
          data: {
            memberId,
            brandId,
            eventType: 'redemption',
            pointsEarned: -reward.pointsCost,
            rulesApplied: [],
          },
        })

        // 6. Create Redemption record
        return tx.redemption.create({
          data: {
            memberId,
            rewardId,
            brandId,
            pointsSpent: reward.pointsCost,
            status: 'PENDING',
          },
        })
      })

      return reply.status(201).send(redemption)
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException

      if (error.code === 'INSUFFICIENT_POINTS') {
        return reply.status(422).send({ error: 'Insufficient points balance' })
      }

      if (error.code === 'OUT_OF_STOCK') {
        return reply.status(422).send({ error: 'Reward is no longer available.' })
      }

      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send({ error: error.message })
      }

      // Re-throw unexpected errors
      throw err
    }
  })
}

export default redemptionsRoutes
