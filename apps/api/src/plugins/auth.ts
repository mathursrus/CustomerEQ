import fp from 'fastify-plugin'
import { verifyToken } from '@clerk/backend'
import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    brandId: string
    clerkUserId: string
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
          // Unexpected DB error — log and continue to the legacy fallback
          // so a transient Prisma issue doesn't take down the whole auth
          // path. The fallback is cheap and safe.
          fastify.log.warn({ err }, 'api_keys lookup failed, falling through to env fallback')
        }
        dbKey = null
      }
      if (dbKey && dbKey.revokedAt === null) {
        request.brandId = dbKey.brandId
        request.clerkUserId = 'api-key'
        // Fire-and-forget lastUsedAt update — don't block the request.
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
    if ((request.routeOptions?.config as unknown as Record<string, unknown>)?.public === true) {
      return
    }

    if (!authHeader) {
      return reply
        .status(401)
        .send({ error: 'Authorization header is required' })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')

    let payload: Awaited<ReturnType<typeof verifyToken>>
    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })
    } catch {
      return reply
        .status(401)
        .send({ error: 'Invalid or expired token' })
    }

    const raw = payload as unknown as Record<string, unknown>
    // Clerk JWT v2 nests org under `o.id`; v1 uses top-level `org_id`
    const orgId =
      (raw.org_id as string | undefined) ??
      ((raw.o as Record<string, string> | undefined)?.id)

    // In development, fall back to user sub when Clerk Organizations are not
    // enabled (avoids the Clerk dashboard prerequisite for local testing)
    const tenantKey = orgId ?? (process.env.NODE_ENV !== 'production' ? payload.sub : null)
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
      return reply
        .status(401)
        .send({ error: 'Brand not found for the provided organization' })
    }

    request.brandId = brand.id
    request.clerkUserId = payload.sub
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['prisma'],
})
