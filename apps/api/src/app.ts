import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import prismaPlugin from './plugins/prisma.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import multiTenantPlugin from './plugins/multiTenant.js'
import auditPlugin from './plugins/audit.js'
import { initQueues } from './queues/bullmq.js'

import programsRoutes from './routes/programs.js'
import membersRoutes from './routes/members.js'
import eventsRoutes from './routes/events.js'
import rewardsRoutes from './routes/rewards.js'
import redemptionsRoutes from './routes/redemptions.js'
import campaignsRoutes from './routes/campaigns.js'
import analyticsRoutes from './routes/analytics.js'
import webhooksRoutes from './routes/webhooks.js'
import publicRoutes from './routes/public.js'

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  // Register plugins in dependency order
  await fastify.register(cors, {
    origin: [/localhost/, /\.azurecontainerapps\.io$/, /\.wellnessatwork\.me$/],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await fastify.register(sensible)
  await fastify.register(prismaPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(authPlugin)
  await fastify.register(multiTenantPlugin)
  await fastify.register(auditPlugin)

  // Initialize BullMQ queues with the Redis connection
  fastify.addHook('onReady', () => {
    initQueues(fastify.redis)
  })

  // Health-check endpoint — public, no auth required
  fastify.get('/healthz', { config: { public: true } }, async (_request, reply) => {
    const services: { database: 'ok' | 'error'; redis: 'ok' | 'error'; api: 'ok' } = {
      database: 'ok',
      redis: 'ok',
      api: 'ok',
    }

    try {
      await fastify.prisma.$queryRaw`SELECT 1`
    } catch {
      services.database = 'error'
    }

    try {
      await fastify.redis.ping()
    } catch {
      services.redis = 'error'
    }

    const status = services.database === 'ok' && services.redis === 'ok' ? 'ok' : 'degraded'
    const code = status === 'ok' ? 200 : 503

    return reply.status(code).send({
      status,
      services,
      timestamp: new Date().toISOString(),
    })
  })

  // Register all route files with prefix '/v1'
  await fastify.register(programsRoutes, { prefix: '/v1' })
  await fastify.register(membersRoutes, { prefix: '/v1' })
  await fastify.register(eventsRoutes, { prefix: '/v1' })
  await fastify.register(rewardsRoutes, { prefix: '/v1' })
  await fastify.register(redemptionsRoutes, { prefix: '/v1' })
  await fastify.register(campaignsRoutes, { prefix: '/v1' })
  await fastify.register(analyticsRoutes, { prefix: '/v1' })
  await fastify.register(webhooksRoutes, { prefix: '/v1' })
  await fastify.register(publicRoutes, { prefix: '/v1' })

  return fastify
}
