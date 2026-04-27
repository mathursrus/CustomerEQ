/// <reference types="vitest" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { createHash } from 'node:crypto'
import apiKeysRoutes from './apiKeys.js'

// Spin up a Fastify instance with a mocked prisma + a fake auth plugin that
// sets brandId/clerkUserId so the real routes can be exercised. We can then
// hit the routes via fastify.inject and verify behavior end-to-end.

interface ApiKeyRow {
  id: string
  brandId: string
  name: string
  keyPrefix: string
  keyHash: string
  createdBy: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

function buildApp(initialKeys: ApiKeyRow[] = [], brandId = 'brand_acme') {
  const app = Fastify()
  const keys = [...initialKeys]

  const prismaMock = {
    apiKey: {
      findMany: vi.fn(async ({ where }: { where: { brandId: string } }) => {
        return keys
          .filter((k) => k.brandId === where.brandId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; brandId: string } }) => {
        return keys.find((k) => k.id === where.id && k.brandId === where.brandId) ?? null
      }),
      create: vi.fn(async ({ data }: { data: Omit<ApiKeyRow, 'id' | 'createdAt' | 'lastUsedAt' | 'revokedAt'> }) => {
        const row: ApiKeyRow = {
          ...data,
          id: `key_${keys.length + 1}`,
          createdAt: new Date('2026-04-12T00:00:00Z'),
          lastUsedAt: null,
          revokedAt: null,
        }
        keys.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ApiKeyRow> }) => {
        const idx = keys.findIndex((k) => k.id === where.id)
        if (idx === -1) throw new Error('not found')
        keys[idx] = { ...keys[idx], ...data } as ApiKeyRow
        return keys[idx]
      }),
    },
  }

  app.register(
    fp(
      async (fastify) => {
        fastify.decorate('prisma', prismaMock as never)
      },
      { name: 'prisma' },
    ),
  )

  // Fake auth plugin: sets brandId on every request
  app.register(
    fp(
      async (fastify) => {
        fastify.addHook('preHandler', async (req) => {
          req.brandId = brandId
          req.clerkUserId = 'user_test'
        })
      },
      { name: 'auth' },
    ),
  )

  return { app, keys, prismaMock }
}

describe('apiKeysRoutes', () => {
  let app: FastifyInstance | null = null

  afterEach(async () => {
    if (app) await app.close()
    app = null
  })

  describe('GET /api-keys', () => {
    it('returns an empty list when no keys exist', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api-keys' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ keys: [] })
    })

    it('lists keys with masked hash (only prefix visible)', async () => {
      const built = buildApp([
        {
          id: 'key_1',
          brandId: 'brand_acme',
          name: 'Production',
          keyPrefix: 'ceq_prodXXX',
          keyHash: 'abc123',
          createdBy: 'user_test',
          createdAt: new Date('2026-04-01T00:00:00Z'),
          lastUsedAt: new Date('2026-04-10T00:00:00Z'),
          revokedAt: null,
        },
      ])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api-keys' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.keys).toHaveLength(1)
      expect(body.keys[0]).toMatchObject({
        id: 'key_1',
        name: 'Production',
        keyPrefix: 'ceq_prodXXX',
        revokedAt: null,
      })
      // Hash must NOT be in the response
      expect(body.keys[0].keyHash).toBeUndefined()
      // Timestamps are ISO strings
      expect(typeof body.keys[0].createdAt).toBe('string')
      expect(body.keys[0].createdAt).toMatch(/^2026-/)
    })

    it('is scoped to the authenticated brand', async () => {
      const built = buildApp(
        [
          {
            id: 'key_acme',
            brandId: 'brand_acme',
            name: 'Acme',
            keyPrefix: 'ceq_acmeXXX',
            keyHash: 'h1',
            createdBy: 'u',
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          },
          {
            id: 'key_other',
            brandId: 'brand_other',
            name: 'Other',
            keyPrefix: 'ceq_othrXXX',
            keyHash: 'h2',
            createdBy: 'u',
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
        'brand_acme',
      )
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api-keys' })
      const body = JSON.parse(res.body)
      expect(body.keys.map((k: { id: string }) => k.id)).toEqual(['key_acme'])
    })
  })

  describe('POST /api-keys', () => {
    it('creates a new key and returns the plaintext once', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'Production backend' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.name).toBe('Production backend')
      expect(body.key).toMatch(/^ceq_[A-Za-z0-9_-]{40,}$/)
      expect(body.keyPrefix).toMatch(/^ceq_/)
      expect(body.keyPrefix.length).toBe(12)
      expect(body.id).toBeTruthy()
      expect(body.revokedAt).toBeNull()
    })

    it('stores the SHA-256 hash of the plaintext, not the plaintext itself', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'test' },
      })
      const body = JSON.parse(res.body)
      const expectedHash = createHash('sha256').update(body.key).digest('hex')

      // Verify via the mock that the stored hash matches
      expect(built.keys).toHaveLength(1)
      expect(built.keys[0].keyHash).toBe(expectedHash)
      // The plaintext is NEVER stored
      expect(built.keys[0].keyHash).not.toBe(body.key)
    })

    it('rejects an empty name with 422', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(422)
      expect(JSON.parse(res.body).error).toBe('Validation failed')
    })

    it('rejects missing name', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: {},
      })
      expect(res.statusCode).toBe(422)
    })

    it('attaches the created key to the authenticated brand', async () => {
      const built = buildApp([], 'brand_tenant_xyz')
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'Key for tenant xyz' },
      })
      expect(built.keys[0].brandId).toBe('brand_tenant_xyz')
    })
  })

  describe('DELETE /api-keys/:id', () => {
    it('soft-revokes an active key', async () => {
      const built = buildApp([
        {
          id: 'key_1',
          brandId: 'brand_acme',
          name: 'Production',
          keyPrefix: 'ceq_prodXXX',
          keyHash: 'abc',
          createdBy: 'u',
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
        },
      ])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'DELETE', url: '/api-keys/key_1' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ revoked: true })
      expect(built.keys[0].revokedAt).not.toBeNull()
    })

    it('returns 200 + revoked:true for an already-revoked key (idempotent)', async () => {
      const built = buildApp([
        {
          id: 'key_1',
          brandId: 'brand_acme',
          name: 'Production',
          keyPrefix: 'ceq_prodXXX',
          keyHash: 'abc',
          createdBy: 'u',
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: new Date('2026-01-01'),
        },
      ])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'DELETE', url: '/api-keys/key_1' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ revoked: true })
    })

    it('returns 404 for a key that does not exist', async () => {
      const built = buildApp([])
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      const res = await app.inject({ method: 'DELETE', url: '/api-keys/nonexistent' })
      expect(res.statusCode).toBe(404)
    })

    it('returns 404 when revoking a key that belongs to another brand', async () => {
      const built = buildApp(
        [
          {
            id: 'key_other',
            brandId: 'brand_other',
            name: 'Other',
            keyPrefix: 'ceq_othrXXX',
            keyHash: 'abc',
            createdBy: 'u',
            createdAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
        'brand_acme',
      )
      app = built.app
      await app.register(apiKeysRoutes)
      await app.ready()

      // brand_acme tries to revoke brand_other's key
      const res = await app.inject({ method: 'DELETE', url: '/api-keys/key_other' })
      expect(res.statusCode).toBe(404)
      // Other brand's key was NOT revoked
      expect(built.keys[0].revokedAt).toBeNull()
    })
  })
})
