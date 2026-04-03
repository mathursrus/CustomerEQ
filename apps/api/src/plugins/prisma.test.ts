/// <reference types="vitest" />
import { describe, it, expect, vi, afterAll } from 'vitest'
import Fastify from 'fastify'

// Mock the database module to avoid real connections
vi.mock('@customerEQ/database', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}))

import prismaPlugin from './prisma.js'
import { prisma } from '@customerEQ/database'

const mockPrisma = prisma as unknown as {
  $connect: ReturnType<typeof vi.fn>
  $disconnect: ReturnType<typeof vi.fn>
}

describe('prismaPlugin', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('decorates fastify with prisma after registration', async () => {
    const app = Fastify()
    await app.register(prismaPlugin)
    await app.ready()

    expect(app.prisma).toBeDefined()
    expect(mockPrisma.$connect).toHaveBeenCalledOnce()

    await app.close()
  })

  it('disconnects prisma on app close', async () => {
    const app = Fastify()
    await app.register(prismaPlugin)
    await app.ready()

    mockPrisma.$disconnect.mockClear()
    await app.close()

    expect(mockPrisma.$disconnect).toHaveBeenCalledOnce()
  })
})
