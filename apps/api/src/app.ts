import Fastify from 'fastify'
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
