import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

const multiTenantPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', async (request, reply) => {
    if (
      request.body &&
      typeof request.body === 'object' &&
      'brandId' in (request.body as object)
    ) {
      return reply
        .status(400)
        .send({ error: 'brandId must not be provided in request body' })
    }
  })
}

export default fp(multiTenantPlugin, { name: 'multiTenant' })
