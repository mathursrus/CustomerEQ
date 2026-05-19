import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT'])

declare module 'fastify' {
  interface FastifyRequest {
    // Issue #292 Slice 3 / RFC §9 — per-route metadata allowlist. Route
    // handlers populate `request.audit.metadata` with whatever keys make
    // sense for their action; the plugin filters by the route's
    // `config.auditAllowlist` before persisting so handlers cannot leak
    // request bodies, secrets, or unaudited fields into AuditEvent.
    audit?: { metadata: Record<string, unknown> }
  }
}

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

// Issue #292 Slice 3 / RFC §9 — pure filter for the per-route metadata
// allowlist. Returns a new object containing only keys present in BOTH the
// metadata and the allowlist, with `undefined` values dropped (so consumers
// don't get explicit `undefined` properties in the persisted JSON).
function filterMetadata(
  metadata: Record<string, unknown>,
  allowlist: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of allowlist) {
    if (key in metadata && metadata[key] !== undefined) {
      out[key] = metadata[key]
    }
  }
  return out
}

const auditPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', (request, reply, done) => {
    // Audit gating:
    //   - Mutation methods are audited by default (legacy behavior).
    //   - Read methods (GET, HEAD) are audited ONLY when the route declares
    //     `config.auditAction` — used by Issue #423 list + export endpoints
    //     so survey-response reads land in the audit trail per R22 / GDPR
    //     Art. 30 / SOC2 CC7.2. Read-method routes without `auditAction`
    //     remain unaudited so the trail isn't flooded with health-check noise.
    const routeConfig = request.routeOptions?.config as
      | { auditAction?: string }
      | undefined
    const isMutation = MUTATION_METHODS.has(request.method)
    const isAuditedRead = !isMutation && Boolean(routeConfig?.auditAction)
    if (!isMutation && !isAuditedRead) {
      done()
      return
    }

    // Skip if brandId is not set (public routes, or lazy-upsert routes that
    // failed before the handler could assign brandId)
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
    const fullRouteConfig = request.routeOptions?.config as
      | {
          auditAction?: string
          auditResourceType?: string
          auditAllowlist?: readonly string[]
        }
      | undefined

    // Issue #292 Slice 3 — per-route metadata allowlist. When the route
    // declares `config.auditAllowlist`, use the handler-populated
    // `request.audit.metadata` filtered to the allowlist; otherwise fall
    // back to the legacy `{ method, path, statusCode }` shape that all
    // existing routes get for free.
    const allowlist = fullRouteConfig?.auditAllowlist
    const action = fullRouteConfig?.auditAction ?? inferAction(request.method, routePath)
    const resourceType = fullRouteConfig?.auditResourceType ?? action.split('.')[0] ?? 'unknown'
    const resourceId = extractResourceId(routePath, request.url)

    // Issue #241 / NFR-S5 — capture request IP into AuditEvent.metadata via
    // the existing JSON column (no schema change). request.ip honors Fastify's
    // trust-proxy chain when configured. If unavailable (misconfigured trust
    // proxy, or a code path that bypassed the network layer), log a structured
    // WARN but never block the audit row — `requestIp: null` is acceptable.
    let requestIp: string | null
    try {
      requestIp = request.ip ?? null
    } catch {
      requestIp = null
    }
    if (requestIp === null) {
      fastify.log.warn(
        { event: 'audit.ip_unavailable', route: routePath, brandId: request.brandId },
        'request.ip unavailable; persisting AuditEvent.metadata.requestIp = null',
      )
    }
    const enrichedMetadata = {
      ...(request.audit?.metadata ?? {}),
      requestIp,
    }

    const metadata = allowlist
      ? filterMetadata(enrichedMetadata, allowlist)
      : {
          method: request.method,
          path: request.url,
          statusCode: reply.statusCode,
        }

    // Fire-and-forget: do not await, do not slow the response
    fastify.prisma.auditEvent
      .create({
        data: {
          brandId: request.brandId,
          actorId: request.clerkUserId ?? 'unknown',
          action,
          resourceType,
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => {
        fastify.log.error({ err }, 'Failed to write AuditEvent')
      })

    done()
  })
}

export { inferAction, extractResourceId, filterMetadata }
export default fp(auditPlugin, {
  name: 'audit',
  dependencies: ['prisma'],
})
