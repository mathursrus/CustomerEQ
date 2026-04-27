/// <reference types="vitest" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mockClerkVerifyToken } from '@customerEQ/config/test-utils'

// Mock @clerk/backend using the shared clerk mock factory
vi.mock('@clerk/backend', () => ({
  verifyToken: mockClerkVerifyToken('org_default'),
}))

import { verifyToken } from '@clerk/backend'
import fp from 'fastify-plugin'
import authPlugin from './auth.js'

const mockedVerify = vi.mocked(verifyToken)

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

  // Register a fake prisma plugin so the auth plugin's dependency is satisfied
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

  return Object.assign(app, { _apiKeyUpdate: apiKeyUpdate })
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
      app = buildApp()
      await app.register(authPlugin)
      app.options('/test', async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({ method: 'OPTIONS', url: '/test' })

      expect(res.statusCode).toBe(200)
      expect(mockedVerify).not.toHaveBeenCalled()
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
  // Invalid token
  // ---------------------------------------------------------------------------

  describe('invalid token', () => {
    it('returns 401 when verifyToken throws', async () => {
      app = buildApp()
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      mockedVerify.mockRejectedValueOnce(new Error('expired'))

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
  // Clerk JWT v1 (top-level org_id)
  // ---------------------------------------------------------------------------

  describe('Clerk JWT v1 format (org_id)', () => {
    it('resolves brandId from top-level org_id', async () => {
      app = buildApp({ org_v1_123: 'brand-abc' })
      await app.register(authPlugin)
      app.get('/test', async (request) => ({
        brandId: request.brandId,
        userId: request.clerkUserId,
      }))
      await app.ready()

      mockedVerify.mockResolvedValueOnce({
        sub: 'user_v1_456',
        org_id: 'org_v1_123',
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer valid_v1_token' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.brandId).toBe('brand-abc')
      expect(body.userId).toBe('user_v1_456')
    })
  })

  // ---------------------------------------------------------------------------
  // Clerk JWT v2 (nested o.id)
  // ---------------------------------------------------------------------------

  describe('Clerk JWT v2 format (o.id)', () => {
    it('resolves brandId from nested o.id', async () => {
      app = buildApp({ org_v2_789: 'brand-def' })
      await app.register(authPlugin)
      app.get('/test', async (request) => ({
        brandId: request.brandId,
        userId: request.clerkUserId,
      }))
      await app.ready()

      mockedVerify.mockResolvedValueOnce({
        sub: 'user_v2_101',
        o: { id: 'org_v2_789', rol: 'admin' },
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer valid_v2_token' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.brandId).toBe('brand-def')
      expect(body.userId).toBe('user_v2_101')
    })

    it('prefers org_id over o.id when both are present', async () => {
      app = buildApp({ org_v1_direct: 'brand-v1' })
      await app.register(authPlugin)
      app.get('/test', async (request) => ({ brandId: request.brandId }))
      await app.ready()

      mockedVerify.mockResolvedValueOnce({
        sub: 'user_both',
        org_id: 'org_v1_direct',
        o: { id: 'org_v2_nested' },
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token_with_both' },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).brandId).toBe('brand-v1')
    })
  })

  // ---------------------------------------------------------------------------
  // No org_id at all
  // ---------------------------------------------------------------------------

  describe('missing organization ID', () => {
    it('returns 401 when token has neither org_id nor o.id', async () => {
      app = buildApp()
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      mockedVerify.mockResolvedValueOnce({ sub: 'user_no_org' } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token_no_org' },
      })

      // In non-production (test), the dev fallback uses payload.sub as tenant key,
      // so the error comes from brand-not-found rather than missing org ID.
      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toBe('Brand not found for the provided organization')
    })
  })

  // ---------------------------------------------------------------------------
  // X-Api-Key auth (developer-provisioned keys)
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

    it('rejects an unknown key (not in table)', async () => {
      app = buildApp({}, {})
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': 'ceq_totally_bogus' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('falls back to env var when api_keys table is missing (P2021)', async () => {
      // Regression guard: the api_keys table was introduced in #141 but
      // migrations may not have run yet in every environment. When
      // Prisma throws P2021 the auth plugin must swallow it and fall
      // through to the legacy env-var check instead of 500ing out.
      const prevKey = process.env.MCP_API_KEY
      const prevBrand = process.env.MCP_BRAND_ID
      process.env.MCP_API_KEY = 'legacy-mcp-key'
      process.env.MCP_BRAND_ID = 'brand_legacy'
      try {
        const p2021 = Object.assign(new Error('Table does not exist'), { code: 'P2021' })
        // Override the findUnique mock to throw P2021 like Prisma would
        // against a DB missing the api_keys table.
        app = buildApp({}, {})
        // Replace the apiKey.findUnique mock with a thrower
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

    it('updates lastUsedAt on successful auth (fire-and-forget)', async () => {
      const { createHash } = await import('node:crypto')
      const plaintext = 'ceq_lastused_key'
      const keyHash = createHash('sha256').update(plaintext).digest('hex')

      app = buildApp(
        {},
        { [keyHash]: { id: 'key_used', brandId: 'brand_acme', revokedAt: null } },
      )
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
      expect((app as unknown as { _apiKeyUpdate: ReturnType<typeof vi.fn> })._apiKeyUpdate).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // Unknown org
  // ---------------------------------------------------------------------------

  describe('unknown organization', () => {
    it('returns 401 when org_id does not match any brand', async () => {
      app = buildApp({}) // empty — no brands
      await app.register(authPlugin)
      app.get('/test', async () => ({ ok: true }))
      await app.ready()

      mockedVerify.mockResolvedValueOnce({
        sub: 'user_unknown_org',
        org_id: 'org_nonexistent',
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token_unknown_org' },
      })

      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toBe('Brand not found for the provided organization')
    })
  })
})
