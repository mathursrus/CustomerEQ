import type { FastifyPluginAsync } from 'fastify'
import { RecomputeHealthScoreSchema } from '@customerEQ/shared'
import { enqueueHealthScoreComputation } from '../queues/bullmq.js'

const healthScoresRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/admin/health-scores/recompute — trigger on-demand health score recomputation
  fastify.post('/admin/health-scores/recompute', async (request, reply) => {
    const parse = RecomputeHealthScoreSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId

    const job = await enqueueHealthScoreComputation({
      brandId,
      memberId: parse.data.memberId,
    })

    return reply.status(202).send({
      status: 'queued',
      jobId: job.id ?? 'inline',
    })
  })
}

export default healthScoresRoutes
