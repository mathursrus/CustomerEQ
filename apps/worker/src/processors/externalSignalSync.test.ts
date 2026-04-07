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
  })

  it('queues normalized deliveries from configured sample payloads', async () => {
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      scopeConfig: {
        samplePayloads: [
          {
            externalId: 'ext-1',
            body: 'Google review payload',
            rating: 5,
          },
        ],
      },
    })
    enqueueExternalSignalIngestion.mockResolvedValue({ id: 'job-1' })

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
      scopeConfig: {},
    })
    mockPrisma.externalSignalSource.update.mockResolvedValue({})

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
})
