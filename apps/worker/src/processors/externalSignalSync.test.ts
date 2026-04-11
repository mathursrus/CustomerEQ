/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockPrisma } from '@customerEQ/config/test-utils'

vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

vi.mock('pino', async () => {
  const { pinoMockFactory } = await import('@customerEQ/config/test-utils')
  return pinoMockFactory()
})

const { enqueueExternalSignalIngestion } = vi.hoisted(() => ({
  enqueueExternalSignalIngestion: vi.fn(),
}))

vi.mock('../queues/producers.js', () => ({
  enqueueExternalSignalIngestion,
}))

const { mockRedditConnector } = vi.hoisted(() => ({
  mockRedditConnector: vi.fn(),
}))

vi.mock('@customerEQ/connectors', () => ({
  CONNECTORS: {
    REDDIT: mockRedditConnector,
  },
  ConnectorAuthError: class ConnectorAuthError extends Error {
    constructor(provider: string, message: string) {
      super(`[${provider}] Auth error: ${message}`)
      this.name = 'ConnectorAuthError'
    }
  },
  ConnectorRateLimitError: class ConnectorRateLimitError extends Error {
    retryAfterMs: number
    constructor(provider: string, retryAfterMs: number) {
      super(`[${provider}] Rate limited`)
      this.name = 'ConnectorRateLimitError'
      this.retryAfterMs = retryAfterMs
    }
  },
}))

import { prisma } from '@customerEQ/database'
import { createExternalSignalSyncProcessor } from './externalSignalSync.js'

const mockPrisma = prisma as unknown as MockPrisma

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      brandId: 'brand-001',
      sourceId: 'source-001',
      ...overrides,
    },
  }
}

describe('processExternalSignalSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.externalSignalSource.update.mockResolvedValue({})
    enqueueExternalSignalIngestion.mockResolvedValue({ id: 'job-1' })
  })

  it('queues normalized deliveries from configured sample payloads', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'GENERIC_WEBHOOK',
      scopeConfig: {
        samplePayloads: [
          {
            externalId: 'ext-1',
            body: 'Google review payload',
            rating: 5,
          },
        ],
      },
      credentialRef: null,
      lastCursor: null,
    })

    const processor = createExternalSignalSyncProcessor({} as never)
    const result = await processor(makeJob() as never)

    expect(enqueueExternalSignalIngestion).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        brandId: 'brand-001',
        sourceId: 'source-001',
        deliveryType: 'sync',
        deliveries: [
          expect.objectContaining({
            externalId: 'ext-1',
            body: 'Google review payload',
          }),
        ],
      }),
    )
    expect(result).toEqual({ queued: 1 })
  })

  it('marks the source unhealthy when no sample payloads are configured', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'GENERIC_WEBHOOK',
      scopeConfig: {},
      credentialRef: null,
      lastCursor: null,
    })

    const processor = createExternalSignalSyncProcessor({} as never)
    const result = await processor(makeJob() as never)

    expect(mockPrisma.externalSignalSource.update).toHaveBeenCalledWith({
      where: { id: 'source-001' },
      data: expect.objectContaining({
        healthStatus: 'error',
        lastError: 'No sample payloads configured for this source sync.',
      }),
    })
    expect(result).toEqual({ queued: 0 })
  })

  it('dispatches to native connector when sourceType has a registered connector', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'REDDIT',
      scopeConfig: {
        credentials: { clientId: 'id', clientSecret: 'secret' },
        mode: 'subreddit',
        subreddits: ['CustomerEQ'],
      },
      credentialRef: 'reddit-app',
      lastCursor: { after: 't3_prev' },
    })

    mockRedditConnector.mockResolvedValue({
      deliveries: [
        { externalId: 't3_abc', body: 'Reddit post content', author: 'u/test' },
      ],
      nextCursor: { after: 't3_abc' },
    })

    const processor = createExternalSignalSyncProcessor({} as never)
    const result = await processor(makeJob() as never)

    // Connector was called with correct context
    expect(mockRedditConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'source-001',
        brandId: 'brand-001',
        lastCursor: { after: 't3_prev' },
      }),
    )

    // Deliveries were enqueued
    expect(enqueueExternalSignalIngestion).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        sourceId: 'source-001',
        deliveries: [expect.objectContaining({ externalId: 't3_abc' })],
      }),
    )

    // Cursor was persisted
    expect(mockPrisma.externalSignalSource.update).toHaveBeenCalledWith({
      where: { id: 'source-001' },
      data: expect.objectContaining({
        lastCursor: { after: 't3_abc' },
      }),
    })

    expect(result).toEqual({ queued: 1 })
  })

  it('persists updated credentials when connector refreshes tokens', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'REDDIT',
      scopeConfig: {
        credentials: { clientId: 'id', clientSecret: 'secret', accessToken: 'old' },
        mode: 'subreddit',
        subreddits: ['test'],
      },
      credentialRef: null,
      lastCursor: null,
    })

    mockRedditConnector.mockResolvedValue({
      deliveries: [{ externalId: 'post-1', body: 'content' }],
      nextCursor: null,
      updatedCredentials: { clientId: 'id', clientSecret: 'secret', accessToken: 'new-token' },
    })

    const processor = createExternalSignalSyncProcessor({} as never)
    await processor(makeJob() as never)

    expect(mockPrisma.externalSignalSource.update).toHaveBeenCalledWith({
      where: { id: 'source-001' },
      data: expect.objectContaining({
        scopeConfig: expect.objectContaining({
          credentials: expect.objectContaining({ accessToken: 'new-token' }),
        }),
      }),
    })
  })

  it('sets healthStatus to auth_error on ConnectorAuthError and does not rethrow', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'REDDIT',
      scopeConfig: { credentials: { clientId: 'id', clientSecret: 'bad' } },
      credentialRef: null,
      lastCursor: null,
    })

    const { ConnectorAuthError } = await import('@customerEQ/connectors')
    mockRedditConnector.mockRejectedValue(new ConnectorAuthError('Reddit', 'Invalid credentials'))

    const processor = createExternalSignalSyncProcessor({} as never)
    const result = await processor(makeJob() as never)

    expect(mockPrisma.externalSignalSource.update).toHaveBeenCalledWith({
      where: { id: 'source-001' },
      data: expect.objectContaining({
        healthStatus: 'auth_error',
      }),
    })
    // Should not throw — auth errors are terminal, not retryable
    expect(result).toEqual(expect.objectContaining({ queued: 0 }))
  })

  it('rethrows ConnectorRateLimitError for BullMQ retry', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'REDDIT',
      scopeConfig: { credentials: { clientId: 'id', clientSecret: 'secret' } },
      credentialRef: null,
      lastCursor: null,
    })

    const { ConnectorRateLimitError } = await import('@customerEQ/connectors')
    mockRedditConnector.mockRejectedValue(new ConnectorRateLimitError('Reddit', 60_000))

    const processor = createExternalSignalSyncProcessor({} as never)
    await expect(processor(makeJob() as never)).rejects.toThrow('Rate limited')
  })

  it('falls back to samplePayloads for source types without a connector', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      sourceType: 'GENERIC_API',
      scopeConfig: {
        samplePayloads: [{ externalId: 'api-1', body: 'API data' }],
      },
      credentialRef: null,
      lastCursor: null,
    })

    const processor = createExternalSignalSyncProcessor({} as never)
    const result = await processor(makeJob() as never)

    expect(mockRedditConnector).not.toHaveBeenCalled()
    expect(enqueueExternalSignalIngestion).toHaveBeenCalled()
    expect(result).toEqual({ queued: 1 })
  })
})
