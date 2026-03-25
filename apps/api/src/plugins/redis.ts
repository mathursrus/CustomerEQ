import fp from 'fastify-plugin'
import { Redis as IORedis } from 'ioredis'
import type { FastifyPluginAsync } from 'fastify'

type RedisInstance = IORedis

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisInstance
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis: RedisInstance = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  })

  redis.on('error', (err: unknown) => {
    fastify.log.error({ err }, 'Redis connection error')
  })

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
  })
}

export default fp(redisPlugin, { name: 'redis' })
