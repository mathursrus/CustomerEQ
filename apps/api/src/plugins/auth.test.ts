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

function buildApp(brandLookup: Record<string, string> = {}) {
  const app = Fastify()

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
        } as never)
      },
      { name: 'prisma' },
    ),
  )

  return app
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
