/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { reconcileMigration } from './migrationReconciliation.js'

// Unit tests (mocked Prisma) for the reconciliation sweep (R20/R21/§F).
// Integration tests cover the end-to-end R20 concurrency behavior against a DB.

function buildMock(opts: {
  brandId?: string
  createdAt?: Date
  alreadyMapped?: string[] // memberIds already in the mapping
  orphans?: Array<{ id: string; externalId: string }>
  createThrowsFor?: string[] // memberIds whose create raises a unique violation
}) {
  const createCalls: Array<{ memberId: string }> = []
  const create = vi.fn().mockImplementation(({ data }) => {
    createCalls.push({ memberId: data.memberId })
    if (opts.createThrowsFor?.includes(data.memberId)) {
      return Promise.reject(new Error('Unique constraint failed'))
    }
    return Promise.resolve({ id: `map_${data.memberId}` })
  })
  const update = vi.fn().mockResolvedValue({})
  const deleteFn = vi.fn()
  const prisma = {
    memberIdentifierMigration: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        brandId: opts.brandId ?? 'brand-1',
        createdAt: opts.createdAt ?? new Date('2026-05-01T00:00:00Z'),
      }),
      update,
    },
    memberIdentifierMigrationMapping: {
      findMany: vi.fn().mockResolvedValue((opts.alreadyMapped ?? []).map((id) => ({ memberId: id }))),
      create,
    },
    member: {
      findMany: vi.fn().mockResolvedValue(opts.orphans ?? []),
      delete: deleteFn, // present only to assert it's NEVER called (R21)
    },
  } as unknown as PrismaClient
  return { prisma, create, update, deleteFn, createCalls }
}

describe('reconcileMigration (Issue #524)', () => {
  it('R20 — records each orphan member as a mapping row and bumps reconciledMembers', async () => {
    const { prisma, create, update } = buildMock({
      orphans: [
        { id: 'm_a', externalId: 'cust_a' },
        { id: 'm_b', externalId: 'cust_b' },
      ],
    })
    const result = await reconcileMigration(prisma, 'mig1')
    expect(result.reconciled).toBe(2)
    expect(create).toHaveBeenCalledTimes(2)
    // oldExternalId === newExternalId === the member's current externalId (phantom)
    const firstData = create.mock.calls[0][0].data
    expect(firstData.oldExternalId).toBe('cust_a')
    expect(firstData.newExternalId).toBe('cust_a')
    expect(firstData.appliedAt).toBeInstanceOf(Date)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reconciledMembers: { increment: 2 } } }),
    )
  })

  it('R21 — never hard-deletes a member', async () => {
    const { prisma, deleteFn } = buildMock({
      orphans: [{ id: 'm_a', externalId: 'cust_a' }],
    })
    await reconcileMigration(prisma, 'mig1')
    expect(deleteFn).not.toHaveBeenCalled()
  })

  it('idempotent — no orphans (all already mapped) → zero reconciled, no counter update', async () => {
    const { prisma, create, update } = buildMock({ orphans: [] })
    const result = await reconcileMigration(prisma, 'mig1')
    expect(result.reconciled).toBe(0)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('a concurrent unique-violation on create is not counted (race-safe)', async () => {
    const { prisma, update } = buildMock({
      orphans: [
        { id: 'm_a', externalId: 'cust_a' },
        { id: 'm_b', externalId: 'cust_b' },
      ],
      createThrowsFor: ['m_b'], // already reconciled by a concurrent sweep
    })
    const result = await reconcileMigration(prisma, 'mig1')
    expect(result.reconciled).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reconciledMembers: { increment: 1 } } }),
    )
  })
})
