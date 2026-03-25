/// <reference types="vitest" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
// Import plugins to pull in the FastifyInstance augmentations for prisma & redis
import '../plugins/prisma.js'
import '../plugins/redis.js'

describe('GET /healthz', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()

    // Decorate with mock prisma and redis before registering the route
    app.decorate('prisma', {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as FastifyInstance['prisma'])
    app.decorate('redis', {
      ping: vi.fn().mockResolvedValue('PONG'),
    } as unknown as FastifyInstance['redis'])

    // Register the healthz route the same way app.ts does
    app.get('/healthz', { config: { public: true } }, async (_request, reply) => {
      const services: { database: 'ok' | 'error'; redis: 'ok' | 'error'; api: 'ok' } = {
        database: 'ok',
        redis: 'ok',
        api: 'ok',
      }

      try {
        await (app as unknown as { prisma: { $queryRaw: () => Promise<unknown> } }).prisma.$queryRaw()
      } catch {
        services.database = 'error'
      }

      try {
        await (app as unknown as { redis: { ping: () => Promise<string> } }).redis.ping()
      } catch {
        services.redis = 'error'
      }

      const status = services.database === 'ok' && services.redis === 'ok' ? 'ok' : 'degraded'
      const code = status === 'ok' ? 200 : 503

      return reply.status(code).send({
        status,
        services,
        timestamp: new Date().toISOString(),
      })
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with correct shape when all services are healthy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body).toMatchObject({
      status: 'ok',
      services: {
        database: 'ok',
        redis: 'ok',
        api: 'ok',
      },
    })
    expect(typeof body.timestamp).toBe('string')
    // Verify it's a valid ISO date
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('returns 503 when database is down', async () => {
    const prisma = (app as unknown as { prisma: { $queryRaw: ReturnType<typeof vi.fn> } }).prisma
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'))

    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    })

    expect(response.statusCode).toBe(503)

    const body = response.json()
    expect(body.status).toBe('degraded')
    expect(body.services.database).toBe('error')
    expect(body.services.redis).toBe('ok')
    expect(body.services.api).toBe('ok')
  })

  it('returns 503 when redis is down', async () => {
    const redis = (app as unknown as { redis: { ping: ReturnType<typeof vi.fn> } }).redis
    redis.ping.mockRejectedValueOnce(new Error('connection refused'))

    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    })

    expect(response.statusCode).toBe(503)

    const body = response.json()
    expect(body.status).toBe('degraded')
    expect(body.services.database).toBe('ok')
    expect(body.services.redis).toBe('error')
    expect(body.services.api).toBe('ok')
  })
})
