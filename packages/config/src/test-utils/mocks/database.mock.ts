import { vi } from 'vitest'

/**
 * Creates a mock prisma instance for unit tests that mock @customerEQ/database.
 * Each call returns fresh vi.fn() instances.
 *
 * Usage:
 *   import { databaseMockFactory } from '@customerEQ/config/test-utils'
 *   vi.mock('@customerEQ/database', () => databaseMockFactory())
 */
export function databaseMockFactory() {
  return {
    prisma: createMockPrisma(),
  }
}

/**
 * Creates a mock prisma object with vi.fn() stubs for common model operations.
 * Extend this as new models are added to the schema.
 */
export function createMockPrisma() {
  return {
    campaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyaltyEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    campaignEvent: {
      create: vi.fn(),
    },
    brand: {
      findUnique: vi.fn(),
    },
    externalSignalSource: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    externalSignal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    feedbackCluster: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    surveyResponse: {
      findMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    clusterSnapshot: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    feedbackAnomaly: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  }
}

/** Helper type for the mock prisma returned by createMockPrisma */
export type MockPrisma = ReturnType<typeof createMockPrisma>
