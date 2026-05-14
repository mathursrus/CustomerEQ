import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import prismaPlugin from './plugins/prisma.js'
import redisPlugin from './plugins/redis.js'
import identityProviderPlugin from './plugins/identityProvider.js'
import authPlugin from './plugins/auth.js'
import multiTenantPlugin from './plugins/multiTenant.js'
import auditPlugin from './plugins/audit.js'
import ipGeoPlugin from './plugins/ipGeo.js'
import { initQueues } from './queues/bullmq.js'

import programsRoutes from './routes/programs.js'
import membersRoutes from './routes/members.js'
import eventsRoutes from './routes/events.js'
import rewardsRoutes from './routes/rewards.js'
import redemptionsRoutes from './routes/redemptions.js'
import campaignsRoutes from './routes/campaigns.js'
import analyticsRoutes from './routes/analytics.js'
import externalSignalsRoutes from './routes/externalSignals.js'
import webhooksRoutes from './routes/webhooks.js'
import oauthRoutes from './routes/oauth.js'
import publicRoutes from './routes/public.js'
import surveysRoutes from './routes/surveys.js'
import themesRoutes from './routes/themes.js'
import templatesRoutes from './routes/templates.js'
import alertRulesRoutes from './routes/alertRules.js'
import casesRoutes from './routes/cases.js'
import campaignPlayRoutes from './routes/campaignPlay.js'
import supportPublicRoutes from './routes/support-public.js'
import supportAdminRoutes from './routes/support-admin.js'
import kbRoutes from './routes/kb.js'
import kbSourceRoutes from './routes/kb-sources.js'
import supportWidgetConfigRoutes from './routes/support-widget-config.js'
import supportCsatRoutes from './routes/support-csat.js'
import intentRoutes from './routes/intent.js'
import healthScoresRoutes from './routes/healthScores.js'
import cxPlaybooksRoutes from './routes/cxPlaybooks.js'
import apiKeysRoutes from './routes/apiKeys.js'
import developerRoutes from './routes/developer.js'
import outboundWebhooksRoutes from './routes/outboundWebhooks.js'
import authRoutes from './routes/auth.js'
import identityProviderWebhookRoutes from './routes/identityProviderWebhook.js'
import adminBrandProfileRoutes from './routes/admin-brand-profile.js'
import webhooksSlackRoutes from './routes/webhooks-slack.js'

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

  // Allow DELETE requests with Content-Type: application/json but no body (empty body → {})
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).trim() === '') {
      done(null, {})
      return
    }
    try {
      done(null, JSON.parse(body as string))
    } catch (err) {
      done(err as Error)
    }
  })

  await fastify.register(sensible)
  await fastify.register(prismaPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(identityProviderPlugin)
  await fastify.register(authPlugin)
  await fastify.register(multiTenantPlugin)
  await fastify.register(auditPlugin)
  await fastify.register(ipGeoPlugin)

  // Initialize BullMQ queues with the Redis connection
  fastify.addHook('onReady', () => {
    initQueues(fastify.redis as unknown as import('bullmq').ConnectionOptions)
  })

  // Health-check endpoint — public, no auth required
  fastify.get('/healthz', { config: { public: true } }, async (_request, reply) => {
    const services: { database: 'ok' | 'error'; redis: 'ok' | 'error' | 'inline-mode'; api: 'ok' } = {
      database: 'ok',
      redis: 'ok',
      api: 'ok',
    }

    try {
      await fastify.prisma.$queryRaw`SELECT 1`
    } catch {
      services.database = 'error'
    }

    if (fastify.redis) {
      try {
        await fastify.redis.ping()
      } catch {
        services.redis = 'error'
      }
    } else {
      services.redis = 'inline-mode'
    }

    const status = services.database === 'ok' && services.redis !== 'error' ? 'ok' : 'degraded'
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
  await fastify.register(externalSignalsRoutes, { prefix: '/v1' })
  await fastify.register(webhooksRoutes, { prefix: '/v1' })
  await fastify.register(oauthRoutes, { prefix: '/v1' })
  await fastify.register(surveysRoutes, { prefix: '/v1' })
  await fastify.register(themesRoutes, { prefix: '/v1' })
  await fastify.register(templatesRoutes, { prefix: '/v1' })
  await fastify.register(alertRulesRoutes, { prefix: '/v1' })
  await fastify.register(casesRoutes, { prefix: '/v1' })
  await fastify.register(publicRoutes, { prefix: '/v1' })
  await fastify.register(campaignPlayRoutes, { prefix: '/v1' })
  await fastify.register(supportPublicRoutes, { prefix: '/v1' })
  await fastify.register(supportAdminRoutes, { prefix: '/v1' })
  await fastify.register(kbRoutes, { prefix: '/v1' })
  await fastify.register(kbSourceRoutes, { prefix: '/v1' })
  await fastify.register(supportWidgetConfigRoutes, { prefix: '/v1' })
  await fastify.register(supportCsatRoutes, { prefix: '/v1' })
  await fastify.register(intentRoutes, { prefix: '/v1' })
  await fastify.register(healthScoresRoutes, { prefix: '/v1' })
  await fastify.register(cxPlaybooksRoutes, { prefix: '/v1' })
  await fastify.register(apiKeysRoutes, { prefix: '/v1' })
  await fastify.register(developerRoutes, { prefix: '/v1' })
  await fastify.register(outboundWebhooksRoutes, { prefix: '/v1' })
  await fastify.register(adminBrandProfileRoutes, { prefix: '/v1' })
  await fastify.register(webhooksSlackRoutes)

  // Issue #170 PR 2 — Auth API + Clerk webhook handler. These routes have
  // their full path in the route definition (/api/auth/*, /api/webhooks/*),
  // so they register at the root prefix.
  await fastify.register(authRoutes)
  await fastify.register(identityProviderWebhookRoutes)

  return fastify
}
