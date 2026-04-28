/// <reference types="vitest" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

import fp from 'fastify-plugin'
import authPlugin from './auth.js'
import type { IdentityProvider } from '../auth/identity-provider.js'

interface ApiKeyRow {
  id: string
  brandId: string
  revokedAt: Date | null
}

function buildApp(
  brandLookup: Record<string, string> = {},
  apiKeyLookup: Record<string, ApiKeyRow> = {},
) {
  const app = Fastify()
  const apiKeyUpdate = vi.fn(async () => ({}))
  const getSession = vi.fn() as unknown as IdentityProvider['getSession']

  // Fake prisma plugin (auth plugin depends on it)
  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('prisma', {
          brand: {
            findUnique: vi.fn(async ({ where }: { where: { clerkOrgId?: string } }) => {
              const id = where.clerkOrgId ? brandLookup[where.clerkOrgId] : undefined
              return id ? { id } : null
            }),
          },
          apiKey: {
            findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => {
              return apiKeyLookup[where.keyHash] ?? null
            }),
            update: apiKeyUpdate,
          },
        } as never)
      },
      { name: 'prisma' },
    ),
  )

  // Fake identity-provider plugin (auth plugin depends on it after refactor)
  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('identityProvider', {
          getSession,
        } as unknown as IdentityProvider)
      },
      { name: 'identityProvider' },
    ),
  )

  return Object.assign(app, {
    _apiKeyUpdate: apiKeyUpdate,
    _getSession: getSession as ReturnType<typeof vi.fn>,
  })
}

describe('authPlugin', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // OPTIONS preflight
  // ---------------------------------------------------------------------------

  describe('OPTIONS preflight', () => {
    it('skips auth for OPTIONS requests', async () => {
      const built = buildApp()
      app = built
      await app.register(authPlugin)
      app.options('/test', async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({ method: 'OPTIONS', url: '/test' })

      expect(res.statusCode).toBe(200)
      expect(built._getSession).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Missing Authorization header
  // ---------------------------------------------------------------------------

  describe('missing Authorization header', () => {
    it('returns 401 for non-public routes without Authorization', async () => {
      app = buildApp()
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/test' })

      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toBe('Authorization header is required')
    })

    it('allows public routes without Authorization', async () => {
      app = buildApp()
      await app.register(authPlugin)
      app.get('/test', { config: { public: true } as never }, async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/test' })

      expect(res.statusCode).toBe(200)
    })
  })

  // ---------------------------------------------------------------------------
  // Invalid / expired token (IdentityProvider.getSession returns null)
  // ---------------------------------------------------------------------------

  describe('invalid token', () => {
    it('returns 401 when getSession returns null', async () => {
      const built = buildApp()
      app = built
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      built._getSession.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer bad_token' },
      })

      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toBe('Invalid or expired token')
    })
  })

  // ---------------------------------------------------------------------------
  // Valid session — IdentityProvider abstracts JWT shape; the auth plugin only
  // sees `{ userId, orgId }` and does the brand lookup from there.
  // ---------------------------------------------------------------------------

  describe('valid session', () => {
    it('resolves brandId from getSession.orgId', async () => {
      const built = buildApp({ org_via_abstraction: 'brand-abc' })
      app = built
      await app.register(authPlugin)
      app.get('/test', async (request) => ({
        brandId: request.brandId,
        userId: request.clerkUserId,
      }))
      await app.ready()

      built._getSession.mockResolvedValueOnce({
        userId: 'user_abs',
        orgId: 'org_via_abstraction',
      })

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer valid' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.brandId).toBe('brand-abc')
      expect(body.userId).toBe('user_abs')
    })

    it('returns 401 in production when session has no orgId (new-user-without-org case)', async () => {
      // Per RFC §4 oauth-callback row: in production, when a fresh OAuth user
      // has no org yet, the auth plugin (used on protected admin routes)
      // returns 401 with the explicit "no org" error. The new /signup/finish
      // route handles the convergence; the redirect is owned by the web
      // middleware, not the API. (In dev/test we fall back to userId as
      // tenantKey for local convenience — covered separately below.)
      const prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      try {
        const built = buildApp()
        app = built
        await app.register(authPlugin)
        app.get('/test', async () => ({ ok: true }))
        await app.ready()

        built._getSession.mockResolvedValueOnce({ userId: 'user_oauth_fresh', orgId: null })

        const res = await app.inject({
          method: 'GET',
          url: '/test',
          headers: { authorization: 'Bearer fresh_oauth' },
        })

        expect(res.statusCode).toBe(401)
        expect(JSON.parse(res.body).error).toBe('Token does not contain an organization ID')
      } finally {
        process.env.NODE_ENV = prevEnv
      }
    })

    it('falls back to userId as tenantKey in dev/test (Clerk-orgs-disabled local flow)', async () => {
      const built = buildApp({ user_dev_local: 'brand-dev-local' })
      app = built
      await app.register(authPlugin)
      app.get('/test', async (req) => ({ brandId: req.brandId }))
      await app.ready()

      built._getSession.mockResolvedValueOnce({ userId: 'user_dev_local', orgId: null })

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer dev_token' },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).brandId).toBe('brand-dev-local')
    })
  })

  // ---------------------------------------------------------------------------
  // Unknown organization — getSession succeeds but no brand row exists
  // ---------------------------------------------------------------------------

  describe('unknown organization', () => {
    it('returns 401 when orgId does not match any brand', async () => {
      const built = buildApp({}) // empty — no brands
      app = built
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      built._getSession.mockResolvedValueOnce({
        userId: 'user_unknown',
        orgId: 'org_nonexistent',
      })

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token_unknown_org' },
      })

      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toBe('Brand not found for the provided organization')
    })
  })

  // ---------------------------------------------------------------------------
  // X-Api-Key auth (developer-provisioned keys) — unchanged by IdentityProvider
  // refactor; identity-provider only abstracts JWT verification.
  // ---------------------------------------------------------------------------

  describe('X-Api-Key auth', () => {
    it('accepts a valid DB-backed key and sets brandId', async () => {
      const { createHash } = await import('node:crypto')
      const plaintext = 'ceq_testkey_abcdef123456'
      const keyHash = createHash('sha256').update(plaintext).digest('hex')

      app = buildApp(
        {},
        { [keyHash]: { id: 'key_1', brandId: 'brand_acme', revokedAt: null } },
      )
      await app.register(authPlugin)
      app.get('/test', async (req) => ({ brandId: req.brandId, userId: req.clerkUserId }))
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': plaintext },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ brandId: 'brand_acme', userId: 'api-key' })
    })

    it('rejects a revoked key', async () => {
      const { createHash } = await import('node:crypto')
      const plaintext = 'ceq_revoked_key'
      const keyHash = createHash('sha256').update(plaintext).digest('hex')

      app = buildApp(
        {},
        {
          [keyHash]: {
            id: 'key_revoked',
            brandId: 'brand_acme',
            revokedAt: new Date('2026-01-01'),
          },
        },
      )
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': plaintext },
      })

      expect(res.statusCode).toBe(401)
    })

    it('falls back to MCP_API_KEY env var for back-compat', async () => {
      const prevKey = process.env.MCP_API_KEY
      const prevBrand = process.env.MCP_BRAND_ID
      process.env.MCP_API_KEY = 'legacy-mcp-key'
      process.env.MCP_BRAND_ID = 'brand_legacy'
      try {
        app = buildApp({}, {})
        await app.register(authPlugin)
        app.get('/test', async (req) => ({ brandId: req.brandId, userId: req.clerkUserId }))
        await app.ready()

        const res = await app.inject({
          method: 'GET',
          url: '/test',
          headers: { 'x-api-key': 'legacy-mcp-key' },
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.body)).toEqual({ brandId: 'brand_legacy', userId: 'mcp-server' })
      } finally {
        if (prevKey === undefined) delete process.env.MCP_API_KEY
        else process.env.MCP_API_KEY = prevKey
        if (prevBrand === undefined) delete process.env.MCP_BRAND_ID
        else process.env.MCP_BRAND_ID = prevBrand
      }
    })

    it('falls back to env var when api_keys table is missing (P2021)', async () => {
      const prevKey = process.env.MCP_API_KEY
      const prevBrand = process.env.MCP_BRAND_ID
      process.env.MCP_API_KEY = 'legacy-mcp-key'
      process.env.MCP_BRAND_ID = 'brand_legacy'
      try {
        const p2021 = Object.assign(new Error('Table does not exist'), { code: 'P2021' })
        app = buildApp({}, {})
        const prisma = (app as unknown as { prisma: { apiKey: { findUnique: ReturnType<typeof vi.fn> } } }).prisma
        if (prisma?.apiKey?.findUnique) {
          prisma.apiKey.findUnique.mockRejectedValueOnce(p2021)
        }
        await app.register(authPlugin)
        app.get('/test', async (req) => ({ brandId: req.brandId, userId: req.clerkUserId }))
        await app.ready()

        const res = await app.inject({
          method: 'GET',
          url: '/test',
          headers: { 'x-api-key': 'legacy-mcp-key' },
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.body)).toEqual({ brandId: 'brand_legacy', userId: 'mcp-server' })
      } finally {
        if (prevKey === undefined) delete process.env.MCP_API_KEY
        else process.env.MCP_API_KEY = prevKey
        if (prevBrand === undefined) delete process.env.MCP_BRAND_ID
        else process.env.MCP_BRAND_ID = prevBrand
      }
    })

    it('updates lastUsedAt on successful auth (fire-and-forget)', async () => {
      const { createHash } = await import('node:crypto')
      const plaintext = 'ceq_lastused_key'
      const keyHash = createHash('sha256').update(plaintext).digest('hex')

      const built = buildApp(
        {},
        { [keyHash]: { id: 'key_used', brandId: 'brand_acme', revokedAt: null } },
      )
      app = built
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': plaintext },
      })

      // Fire-and-forget — give the microtask a beat to flush
      await new Promise((r) => setImmediate(r))
      expect(built._apiKeyUpdate).toHaveBeenCalledOnce()
    })
  })
})
