import fp from 'fastify-plugin'
import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    brandId: string
    clerkUserId: string
    // Issue #292 Slice 3 — populated by the auth plugin for routes that opt
    // into lazy-upsert (`config: { lazyUpsertBrand: true }`). The handler
    // upserts the Brand row keyed by clerkOrgId and assigns `brandId`. All
    // other routes leave this undefined.
    clerkOrgId?: string
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip CORS preflight requests — they never carry Authorization
    if (request.method === 'OPTIONS') return

    const authHeader = request.headers.authorization

    // Test mode bypass — allows integration tests to set brand/user via headers
    const testBrandId = request.headers['x-test-brand-id'] as string | undefined
    if (process.env.NODE_ENV === 'test' && testBrandId) {
      request.brandId = testBrandId
      request.clerkUserId = (request.headers['x-test-user-id'] as string) ?? 'user_test_123'
      return
    }

    // Issue #292 Slice 3 — lazy-upsert test bypass. Sets clerkOrgId only;
    // route handler is responsible for the upsert and brandId assignment.
    // Used by integration tests for `GET /v1/admin/brand/profile` first-call
    // provisioning. Only applies when X-Test-Brand-Id is NOT set (above).
    const testClerkOrgId = request.headers['x-test-clerk-org-id'] as string | undefined
    if (process.env.NODE_ENV === 'test' && testClerkOrgId) {
      request.clerkOrgId = testClerkOrgId
      request.clerkUserId = (request.headers['x-test-user-id'] as string) ?? 'user_test_lazy'
      return
    }

    // Dev bypass — skips Clerk entirely for local development without real keys.
    // Set DEV_BYPASS_AUTH=true in .env. Uses DEV_BRAND_ID if set, otherwise
    // picks the first brand in the DB so it works without manual configuration.
    if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      const brandId = process.env.DEV_BRAND_ID
        ?? (await fastify.prisma.brand.findFirst({ select: { id: true } }))?.id
      if (!brandId) {
        return reply.status(500).send({ error: 'DEV_BYPASS_AUTH: no brand found in database' })
      }
      request.brandId = brandId
      request.clerkUserId = 'dev-bypass'
      return
    }

    // API key auth via X-Api-Key header.
    //
    //   1. Admin-provisioned keys (preferred): look up in the `api_keys`
    //      table by SHA-256 hash. Each key maps to a specific brand and is
    //      revocable from /admin/developer. `lastUsedAt` is updated so the
    //      admin can see activity.
    //   2. Legacy env-var fallback: `MCP_API_KEY` + `MCP_BRAND_ID`. This is
    //      how the MCP server authenticates today and how demos/CI jobs run
    //      without a DB-backed key. Kept for back-compat; the admin UX
    //      should encourage real keys.
    const apiKey = (request.headers['x-api-key'] as string | undefined)?.trim()
    if (apiKey) {
      const keyHash = createHash('sha256').update(apiKey).digest('hex')
      // Guard: the api_keys table was added in #141 but the migration has
      // not yet run in every environment. If Prisma throws P2021 ("table
      // does not exist"), treat it as "no DB-backed key found" and fall
      // through to the legacy env-var check — same behavior the route had
      // before the DB-backed keys feature shipped. Without this guard the
      // entire X-Api-Key auth path (including the MCP server) would 500
      // on any DB that hasn't been migrated yet.
      let dbKey: { id: string; brandId: string; revokedAt: Date | null } | null = null
      try {
        dbKey = await fastify.prisma.apiKey.findUnique({
          where: { keyHash },
          select: { id: true, brandId: true, revokedAt: true },
        })
      } catch (err) {
        const code = (err as { code?: string } | null)?.code
        if (code !== 'P2021') {
          fastify.log.warn({ err }, 'api_keys lookup failed, falling through to env fallback')
        }
      }
      if (dbKey && dbKey.revokedAt === null) {
        request.brandId = dbKey.brandId
        request.clerkUserId = 'api-key'
        void fastify.prisma.apiKey
          .update({ where: { id: dbKey.id }, data: { lastUsedAt: new Date() } })
          .catch(() => { /* best-effort */ })
        return
      }
      // Legacy env-var fallback
      const mcpApiKey = process.env.MCP_API_KEY?.trim()
      if (mcpApiKey && apiKey === mcpApiKey) {
        const mcpBrandId = process.env.MCP_BRAND_ID
        if (!mcpBrandId) {
          return reply.status(500).send({ error: 'MCP_BRAND_ID not configured' })
        }
        request.brandId = mcpBrandId
        request.clerkUserId = 'mcp-server'
        return
      }
    }

    // Skip auth for public routes — they handle their own auth if needed
    const routeConfig = request.routeOptions?.config as
      | { public?: boolean; allowNoOrg?: boolean; lazyUpsertBrand?: boolean }
      | undefined
    if (routeConfig?.public === true) {
      return
    }

    // Issue #423 — accept `?token=<jwt>` as an alternative to
    // `Authorization: Bearer …` for browser-issued downloads (`<a href>`).
    // The exports endpoint (`GET /v1/surveys/:id/responses.xlsx`) cannot
    // inject a Bearer header from an anchor click; the same JWT scoping
    // applies. Tokens MUST be short-lived (Clerk JWTs default to 60s) and
    // are never logged — Fastify does not log query strings by default.
    const queryToken =
      typeof (request.query as { token?: unknown } | undefined)?.token === 'string'
        ? ((request.query as { token: string }).token).trim()
        : ''
    const effectiveAuth = authHeader || (queryToken ? `Bearer ${queryToken}` : undefined)

    if (!effectiveAuth) {
      return reply
        .status(401)
        .send({ error: 'Authorization header is required' })
    }

    const token = effectiveAuth.replace(/^Bearer\s+/i, '')

    // Delegate to the IdentityProvider abstraction (Issue #170 OD-5). The
    // abstraction normalizes Clerk JWT v1 / v2 token shapes and returns a
    // single `{ userId, orgId }` envelope.
    const session = await fastify.identityProvider.getSession(token)
    if (!session) {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    // PR 2 D1=(b): routes marked `config: { allowNoOrg: true }` accept a
    // session with orgId === null without rejecting. `request.clerkUserId`
    // is decorated; `request.brandId` is decorated only when the session
    // actually has an orgId AND the brand exists. Used by
    // /api/auth/signup/finish for the OAuth new-user-without-org case.
    if (routeConfig?.allowNoOrg === true) {
      request.clerkUserId = session.userId
      if (session.orgId) {
        const brand = await fastify.prisma.brand.findUnique({
          where: { clerkOrgId: session.orgId },
          select: { id: true },
        })
        if (brand) {
          request.brandId = brand.id
        }
      }
      return
    }

    // In development, fall back to userId when no orgId is present (avoids
    // the Clerk dashboard prerequisite for local testing). In production,
    // missing orgId means an OAuth-fresh user without an org — which the
    // web middleware redirects to /signup/finish; admin API routes reject.
    const tenantKey =
      session.orgId ?? (process.env.NODE_ENV !== 'production' ? session.userId : null)
    if (!tenantKey) {
      return reply
        .status(401)
        .send({ error: 'Token does not contain an organization ID' })
    }

    const brand = await fastify.prisma.brand.findUnique({
      where: { clerkOrgId: tenantKey },
      select: { id: true },
    })

    if (!brand) {
      // Issue #292 Slice 3 — routes opting into `lazyUpsertBrand: true` skip
      // the 401 short-circuit so the handler can upsert the Brand row keyed
      // by clerkOrgId. Used by `GET /v1/admin/brand/profile` (the
      // post-Clerk-org-create landing target).
      if (routeConfig?.lazyUpsertBrand === true) {
        request.clerkOrgId = tenantKey
        request.clerkUserId = session.userId
        return
      }
      return reply
        .status(401)
        .send({ error: 'Brand not found for the provided organization' })
    }

    request.brandId = brand.id
    request.clerkUserId = session.userId
    request.clerkOrgId = tenantKey
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['prisma', 'identityProvider'],
})
