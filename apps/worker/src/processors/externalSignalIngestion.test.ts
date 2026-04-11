/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MockPrisma } from '@customerEQ/config/test-utils'

vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

vi.mock('pino', async () => {
  const { pinoMockFactory } = await import('@customerEQ/config/test-utils')
  return pinoMockFactory()
})

import { prisma } from '@customerEQ/database'
import { processExternalSignalIngestion } from './externalSignalIngestion.js'

const mockPrisma = prisma as unknown as MockPrisma

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      brandId: 'brand-001',
      sourceId: 'source-001',
      deliveries: [],
      receivedAt: '2026-04-07T19:30:00.000Z',
      deliveryType: 'webhook',
      ...overrides,
    },
  }
}

describe('processExternalSignalIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.externalSignalSource.findFirst.mockResolvedValue({
      id: 'source-001',
      brandId: 'brand-001',
      sourceType: 'GENERIC_WEBHOOK',
      matchingConfig: { memberResolutionEnabled: true },
    })
    mockPrisma.externalSignalSource.update.mockResolvedValue({})
    mockPrisma.member.findUnique.mockResolvedValue({
      id: 'member-001',
      consentGivenAt: new Date('2026-04-01T00:00:00.000Z'),
    })
    mockPrisma.externalSignal.findUnique.mockResolvedValue(null)
    mockPrisma.externalSignal.upsert.mockResolvedValue({})
  })

  it('creates a new matched external signal from an incoming delivery', async () => {
    const result = await processExternalSignalIngestion(makeJob({
      deliveries: [
        {
          externalId: 'ext-1',
          body: 'Public review mentioning the member.',
          memberEmail: 'member@test.com',
          sentiment: -0.3,
          topics: ['delivery'],
        },
      ],
    }) as never)

    expect(mockPrisma.externalSignal.upsert).toHaveBeenCalledWith({
      where: {
        sourceId_externalId: {
          sourceId: 'source-001',
          externalId: 'ext-1',
        },
      },
      update: expect.objectContaining({
        memberId: 'member-001',
        matchStatus: 'MATCHED',
        matchMethod: 'email_exact',
        body: 'Public review mentioning the member.',
      }),
      create: expect.objectContaining({
        brandId: 'brand-001',
        sourceId: 'source-001',
        memberId: 'member-001',
        matchStatus: 'MATCHED',
        matchMethod: 'email_exact',
        externalId: 'ext-1',
        body: 'Public review mentioning the member.',
      }),
    })
    expect(result.importedCount).toBe(1)
  })

  it('updates an existing signal and appends provider status history', async () => {
    mockPrisma.externalSignal.findUnique.mockResolvedValue({
      id: 'signal-001',
      providerStatus: 'visible',
      statusHistory: [],
    })

    await processExternalSignalIngestion(makeJob({
      deliveries: [
        {
          externalId: 'ext-1',
          body: 'Existing external signal',
          providerStatus: 'deleted',
        },
      ],
    }) as never)

    expect(mockPrisma.externalSignal.upsert).toHaveBeenCalledWith({
      where: {
        sourceId_externalId: {
          sourceId: 'source-001',
          externalId: 'ext-1',
        },
      },
      update: expect.objectContaining({
        status: 'DELETED',
        providerStatus: 'deleted',
        statusHistory: [
          expect.objectContaining({
            providerStatus: 'deleted',
          }),
        ],
      }),
      create: expect.objectContaining({
        providerStatus: 'deleted',
        statusHistory: [
          expect.objectContaining({
            providerStatus: 'deleted',
          }),
        ],
      }),
    })
  })
})
