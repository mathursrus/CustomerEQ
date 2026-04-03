/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

// Mock ioredis to avoid real connections
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  }
  return {
    Redis: vi.fn(() => mockRedis),
  }
})

import redisPlugin from './redis.js'

describe('redisPlugin', () => {
  it('decorates fastify with a redis instance', async () => {
    const app = Fastify()
    await app.register(redisPlugin)
    await app.ready()

    expect(app.redis).toBeDefined()

    await app.close()
  })

  it('calls redis.quit on app close', async () => {
    const app = Fastify()
    await app.register(redisPlugin)
    await app.ready()

    const redis = app.redis as unknown as { quit: ReturnType<typeof vi.fn> }
    redis.quit.mockClear()

    await app.close()

    expect(redis.quit).toHaveBeenCalledOnce()
  })
})
