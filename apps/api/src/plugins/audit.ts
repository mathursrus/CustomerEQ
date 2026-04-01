import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT'])

function inferAction(method: string, routePath: string): string {
  // Normalize path: remove /v1/ prefix and any trailing slashes
  const path = routePath.replace(/^\/v1\//, '').replace(/\/$/, '')
  const segments = path.split('/')

  // Resolve the resource name from the first path segment
  const resourceSegment = segments[0] ?? 'unknown'

  // Map plural route segments to singular resource names
  const resourceMap: Record<string, string> = {
    programs: 'program',
    members: 'member',
    events: 'event',
    rewards: 'reward',
    redemptions: 'redemption',
    campaigns: 'campaign',
    analytics: 'analytics',
    integrations: 'integration',
    'demo-requests': 'demo_request',
  }
  const resource = resourceMap[resourceSegment] ?? resourceSegment

  // Check for sub-resource actions
  if (segments.length > 2) {
    const subSegment = segments[segments.length - 1]
    if (subSegment === 'status') return `${resource}.status_update`
    if (subSegment === 'rules') return `${resource}.rule_create`
    if (subSegment === 'enroll') return `${resource}.enroll`
    if (subSegment === 'balance') return `${resource}.balance_read`
  }

  switch (method.toUpperCase()) {
    case 'POST':
      return `${resource}.create`
    case 'PATCH':
      return `${resource}.update`
    case 'PUT':
      return `${resource}.update`
    case 'DELETE':
      return `${resource}.delete`
    default:
      return `${resource}.unknown`
  }
}

function extractResourceId(routePath: string, url: string): string {
  // Try to extract the :id param from the actual URL using the route pattern
  const patternParts = routePath.split('/')
  const urlParts = url.split('?')[0]?.split('/') ?? []

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i]?.startsWith(':') && urlParts[i]) {
      return urlParts[i]
    }
  }
  return 'unknown'
}

const auditPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', (request, reply, done) => {
    // Only audit mutation methods
    if (!MUTATION_METHODS.has(request.method)) {
      done()
      return
    }

    // Skip if brandId is not set (public routes)
    if (!request.brandId) {
      done()
      return
    }

    // Only audit successful responses (2xx)
    if (reply.statusCode < 200 || reply.statusCode >= 300) {
      done()
      return
    }

    const routePath = request.routeOptions?.url ?? request.url
    const action = inferAction(request.method, routePath)
    const resourceType = action.split('.')[0] ?? 'unknown'
    const resourceId = extractResourceId(routePath, request.url)

    // Fire-and-forget: do not await, do not slow the response
    fastify.prisma.auditEvent
      .create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId ?? 'unknown',
          action,
          resourceType,
          resourceId,
          metadata: {
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
          },
        },
      })
      .catch((err: unknown) => {
        fastify.log.error({ err }, 'Failed to write AuditEvent')
      })

    done()
  })
}

export default fp(auditPlugin, {
  name: 'audit',
  dependencies: ['prisma'],
})
