/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient, Member } from '@prisma/client'
import { resolveOrEnrollMember } from './memberResolution.js'

// Issue #524 — dual-key fallback unit tests (R19/R32/R33/R35 §E/§M.4a).
// Prisma is hand-mocked (matching memberResolution.test.ts). The fallback only
// runs on a PRIMARY MISS, so `member.findUnique` is sequenced: first call (by
// composite key) misses; second call (by mapping.memberId) returns the migrated
// member.

function buildMock(opts: {
  brandKind: 'EMAIL' | 'CUSTOMER_ID'
  migration: { id: string; status: string } | null
  mapping: { memberId: string } | null
  migratedMember?: Partial<Member> | null
}) {
  const usageUpsert = vi.fn().mockResolvedValue(undefined)
  // member.findUnique: 1st = primary lookup (miss); 2nd = by id (migrated member)
  const memberFindUnique = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(opts.migratedMember ?? { id: opts.mapping?.memberId ?? 'm1', email: 'new@acme.com', externalId: 'new@acme.com' })
  const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm1', ...data }))
  const create = vi.fn().mockResolvedValue({ id: 'created' })
  const prisma = {
    brand: { findUnique: vi.fn().mockResolvedValue({ memberIdentifierKind: opts.brandKind }) },
    member: { findUnique: memberFindUnique, create, update },
    memberIdentifierMigration: { findFirst: vi.fn().mockResolvedValue(opts.migration) },
    memberIdentifierMigrationMapping: { findUnique: vi.fn().mockResolvedValue(opts.mapping) },
    memberIdentifierMigrationOldKeyUsage: { upsert: usageUpsert },
  } as unknown as PrismaClient
  return { prisma, usageUpsert, create, update, memberFindUnique }
}

describe('resolveOrEnrollMember — dual-key fallback (Issue #524)', () => {
  it('R32 — resolves an OLD customer_id to the migrated member during grace (kind=EMAIL)', async () => {
    const { prisma, create } = buildMock({
      brandKind: 'EMAIL',
      migration: { id: 'mig1', status: 'REKEY_COMPLETE_IN_GRACE' },
      mapping: { memberId: 'm1' },
      migratedMember: { id: 'm1', email: 'jane@acme.com', externalId: 'jane@acme.com' },
    })
    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_00012', // old shape — would FAIL EMAIL shape validation if not for dual-key
      enrolledVia: 'MANUAL_API',
      ingress: 'API_MEMBERS_ENROLL',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.member.id).toBe('m1')
      expect(result.created).toBe(false)
      expect(result.resolvedViaOldKey).toBe(true)
    }
    // No new member created (no duplicate) — R20 invariant.
    expect(create).not.toHaveBeenCalled()
  })

  it('R33 — records old-key usage attributed to the declared ingress', async () => {
    const { prisma, usageUpsert } = buildMock({
      brandKind: 'EMAIL',
      migration: { id: 'mig1', status: 'REKEY_COMPLETE_IN_GRACE' },
      mapping: { memberId: 'm1' },
    })
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_00012',
      enrolledVia: 'SURVEY_RESPONSE',
      ingress: 'PUBLIC_SURVEY_RESPOND',
    })
    expect(usageUpsert).toHaveBeenCalledTimes(1)
    const arg = usageUpsert.mock.calls[0][0]
    expect(arg.create.ingress).toBe('PUBLIC_SURVEY_RESPOND')
    expect(arg.create.migrationId).toBe('mig1')
  })

  it('does NOT record usage when the caller declared no ingress', async () => {
    const { prisma, usageUpsert } = buildMock({
      brandKind: 'EMAIL',
      migration: { id: 'mig1', status: 'PROCESSING' },
      mapping: { memberId: 'm1' },
    })
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_00012',
      enrolledVia: 'MANUAL_API',
      // no ingress
    })
    expect(usageUpsert).not.toHaveBeenCalled()
  })

  it('R35/§M.4a — after grace expiry, an old id matching a retained mapping is rejected as deprecated', async () => {
    const { prisma, create, update } = buildMock({
      brandKind: 'EMAIL',
      migration: { id: 'mig1', status: 'GRACE_EXPIRED' },
      mapping: { memberId: 'm1' },
    })
    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_00012',
      enrolledVia: 'MANUAL_API',
      ingress: 'API_MEMBERS_ENROLL',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('IDENTIFIER_DEPRECATED_AFTER_MIGRATION')
      expect(result.error.expectedKind).toBe('EMAIL')
    }
    // No resolution, no creation post-grace.
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('§M.4b — after grace, an unknown old-shape id (no mapping) falls through to shape rejection', async () => {
    const { prisma } = buildMock({
      brandKind: 'EMAIL',
      migration: { id: 'mig1', status: 'GRACE_EXPIRED' },
      mapping: null, // not in the retained mapping
    })
    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_NEVER_SEEN',
      enrolledVia: 'MANUAL_API',
      ingress: 'API_MEMBERS_ENROLL',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('IDENTIFIER_SHAPE_INVALID')
      expect(result.error.expectedKind).toBe('EMAIL')
    }
  })

  it('no active migration → behaves exactly as before (old behavior unchanged)', async () => {
    const { prisma, create } = buildMock({
      brandKind: 'CUSTOMER_ID',
      migration: null,
      mapping: null,
    })
    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'cust_new',
      enrolledVia: 'MANUAL_API',
    })
    // CUSTOMER_ID brand, no migration → new member created normally.
    expect(result.ok).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
