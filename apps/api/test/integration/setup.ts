import { beforeAll, afterAll, vi } from 'vitest'
import { InMemoryQueue } from '@customerEQ/config/test-utils'

// Mock BullMQ queues — route to InMemoryQueue
vi.mock('../../src/queues/bullmq.js', () => ({
  initQueues: vi.fn(),
  enqueueEvent: vi.fn(async (payload: unknown) => InMemoryQueue.add('loyalty-events', payload)),
  enqueueCampaignTrigger: vi.fn(async (payload: unknown) => InMemoryQueue.add('campaign-triggers', payload)),
  enqueueNotification: vi.fn(async (payload: unknown) => InMemoryQueue.add('notifications', payload)),
  enqueueSentimentAnalysis: vi.fn(async (payload: unknown) => InMemoryQueue.add('sentiment-analysis', payload)),
  enqueueFeedbackClustering: vi.fn(async (payload: unknown) => InMemoryQueue.add('feedback-clustering', payload)),
  enqueueAlertEvaluation: vi.fn(async (payload: unknown) => InMemoryQueue.add('alert-evaluation', payload)),
}))

// Mock ioredis — avoid real Redis connection
vi.mock('ioredis', () => {
  const store = new Map<string, string>()
  const RedisMock = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK' }),
    del: vi.fn(async (key: string) => { store.delete(key); return 1 }),
  }))
  return { Redis: RedisMock, default: RedisMock }
})

// Mock the prisma plugin — use test DB prisma client instead of app singleton
vi.mock('../../src/plugins/prisma.js', async () => {
  const fp = (await import('fastify-plugin')).default
  const { getTestPrisma } = await import('@customerEQ/config/test-utils')
  return {
    default: fp(async (fastify: { decorate: (name: string, value: unknown) => void }) => {
      fastify.decorate('prisma', getTestPrisma())
    }, { name: 'prisma' }),
  }
})

import { setupTestDb, teardownTestDb, setTestApp } from '@customerEQ/config/test-utils'
import { buildApp } from '../../src/app.js'

beforeAll(async () => {
  await setupTestDb()
  const app = await buildApp()
  await app.ready()
  setTestApp(app)
})

afterAll(async () => {
  await teardownTestDb()
})
