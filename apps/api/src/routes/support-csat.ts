import type { FastifyPluginAsync } from 'fastify'
import { SubmitCSATSchema } from '@customerEQ/shared'
import { resolveConversation } from '@customerEQ/ai'
import { enqueueEvent } from '../queues/bullmq.js'

const supportCsatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/public/support/conversations/:id/csat',
    { config: { public: true } },
    async (request, reply) => {
      const parse = SubmitCSATSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
      }
      const { rating, comment, anonId } = parse.data

      const conv = await fastify.prisma.conversation.findUnique({
        where: { id: request.params.id },
        select: { id: true, anonId: true, csatResponse: { select: { id: true, rating: true } } },
      })
      if (!conv) return reply.status(404).send({ error: 'Conversation not found' })

      if (conv.anonId && conv.anonId !== anonId) {
        return reply.status(403).send({ error: 'anonId mismatch' })
      }

      if (conv.csatResponse) {
        return reply.status(200).send({ rating: conv.csatResponse.rating, idempotent: true })
      }

      const result = await resolveConversation(
        {
          conversationId: conv.id,
          source: 'CSAT',
          csat: { rating, comment: comment ?? null },
        },
        { enqueueLoyaltyEvent: (payload) => enqueueEvent(payload).then(() => undefined) },
      )

      return reply.status(200).send({
        rating,
        resolved: rating === 'THUMBS_UP',
        loyaltyEventEmitted: result.loyaltyEventEmitted,
      })
    },
  )
}

export default supportCsatRoutes
