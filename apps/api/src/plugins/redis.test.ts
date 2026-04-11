/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// QUEUE_MODE is read at module load time, so every test must set the env var
// and re-import the plugin. See #135 — prod was stuck on QUEUE_MODE=inline
// and silently skipping Redis; these tests guard that regression and the
// "redis by default" fallback.
describe('redisPlugin', () => {
  const originalQueueMode = process.env.QUEUE_MODE

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalQueueMode === undefined) {
      delete process.env.QUEUE_MODE
    } else {
      process.env.QUEUE_MODE = originalQueueMode
    }
  })

  async function loadPlugin(queueMode: string | undefined) {
    if (queueMode === undefined) {
      delete process.env.QUEUE_MODE
    } else {
      process.env.QUEUE_MODE = queueMode
    }
    const mod = await import('./redis.js')
    return mod.default
  }

  it('decorates fastify with a redis instance when QUEUE_MODE=redis', async () => {
    const plugin = await loadPlugin('redis')
    const app = Fastify()
    await app.register(plugin)
    await app.ready()

    expect(app.redis).not.toBeNull()

    await app.close()
  })

  it('calls redis.quit on app close', async () => {
    const plugin = await loadPlugin('redis')
    const app = Fastify()
    await app.register(plugin)
    await app.ready()

    const redis = app.redis as unknown as { quit: ReturnType<typeof vi.fn> }
    redis.quit.mockClear()

    await app.close()

    expect(redis.quit).toHaveBeenCalledOnce()
  })

  it('skips Redis when QUEUE_MODE=inline (fastify.redis === null)', async () => {
    const plugin = await loadPlugin('inline')
    const app = Fastify()
    await app.register(plugin)
    await app.ready()

    expect(app.redis).toBeNull()

    await app.close()
  })

  it('connects to Redis when QUEUE_MODE is unset (safe default is redis)', async () => {
    const plugin = await loadPlugin(undefined)
    const app = Fastify()
    await app.register(plugin)
    await app.ready()

    expect(app.redis).not.toBeNull()

    await app.close()
  })
})
