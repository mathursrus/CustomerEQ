/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient, Member } from '@prisma/client'
import { resolveOrEnrollMember, validateIdentifierShape } from './memberResolution.js'

// ---------------------------------------------------------------------------
// Identifier shape validation (pure unit tests; no DB)
// ---------------------------------------------------------------------------

describe('validateIdentifierShape', () => {
  describe('EMAIL brand', () => {
    it('accepts an email-shaped memberId', () => {
      expect(validateIdentifierShape('alice@example.com', undefined, 'EMAIL')).toBeNull()
    })

    it('accepts a non-email memberId when an email PII sidecar is supplied', () => {
      expect(validateIdentifierShape('CUST-001', 'alice@example.com', 'EMAIL')).toBeNull()
    })

    it('rejects a non-email memberId without an email sidecar', () => {
      const err = validateIdentifierShape('CUST-001', undefined, 'EMAIL')
      expect(err).not.toBeNull()
      expect(err?.code).toBe('IDENTIFIER_SHAPE_INVALID')
      expect(err?.expectedKind).toBe('EMAIL')
    })

    it('rejects a non-email memberId with a non-email sidecar', () => {
      expect(validateIdentifierShape('CUST-001', 'not-email', 'EMAIL')).not.toBeNull()
    })
  })

  describe('PHONE brand', () => {
    it('accepts an E.164-formatted memberId', () => {
      expect(validateIdentifierShape('+14155552671', undefined, 'PHONE')).toBeNull()
    })

    it('rejects a non-E.164 memberId', () => {
      expect(validateIdentifierShape('415-555-2671', undefined, 'PHONE')?.expectedKind).toBe('PHONE')
    })

    it('rejects a memberId missing the leading +', () => {
      expect(validateIdentifierShape('14155552671', undefined, 'PHONE')).not.toBeNull()
    })
  })

  describe('CUSTOMER_ID brand', () => {
    it('accepts any non-empty opaque string (zod enforces non-empty upstream)', () => {
      expect(validateIdentifierShape('CUST-12345', undefined, 'CUSTOMER_ID')).toBeNull()
      expect(validateIdentifierShape('opaque', undefined, 'CUSTOMER_ID')).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// resolveOrEnrollMember (mocked Prisma)
// ---------------------------------------------------------------------------

function buildPrismaMock(opts: {
  brand: { memberIdentifierKind: 'EMAIL' | 'PHONE' | 'CUSTOMER_ID' } | null
  existingMember?: Partial<Member> | null
  createReturn?: Partial<Member>
  updateReturn?: Partial<Member>
}): { prisma: PrismaClient; spies: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } } {
  const create = vi.fn().mockResolvedValue(opts.createReturn ?? { id: 'new-member', email: null })
  const update = vi.fn().mockResolvedValue(opts.updateReturn ?? { id: 'existing-member' })
  const prisma = {
    brand: {
      findUnique: vi.fn().mockResolvedValue(opts.brand),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue(opts.existingMember ?? null),
      create,
      update,
    },
  } as unknown as PrismaClient
  return { prisma, spies: { create, update } }
}

describe('resolveOrEnrollMember', () => {
  it('throws when brand is not found (programmer error)', async () => {
    const { prisma } = buildPrismaMock({ brand: null })
    await expect(
      resolveOrEnrollMember(prisma, 'brand-1', { memberId: 'a@b.c', enrolledVia: 'MANUAL_API' }),
    ).rejects.toThrow(/Brand brand-1 not found/)
  })

  it('returns IDENTIFIER_SHAPE_INVALID when memberId fails brand-kind validation', async () => {
    const { prisma } = buildPrismaMock({ brand: { memberIdentifierKind: 'EMAIL' } })
    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'CUST-001',
      enrolledVia: 'MANUAL_API',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('IDENTIFIER_SHAPE_INVALID')
    }
  })

  it('creates a new member with externalId = LOWER(TRIM(memberId)) when no existing row', async () => {
    const { prisma, spies } = buildPrismaMock({
      brand: { memberIdentifierKind: 'EMAIL' },
      createReturn: {
        id: 'm1',
        externalId: 'alice@example.com',
        email: 'Alice@Example.com',
        enrolledVia: 'MANUAL_API',
      } as Member,
    })

    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: '  Alice@Example.com  ',
      enrolledVia: 'MANUAL_API',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.updatedFields).toEqual([])
    }
    const createArg = spies.create.mock.calls[0]?.[0] as { data: { externalId: string; email: string | null } }
    expect(createArg.data.externalId).toBe('alice@example.com')
    // Email PII sidecar preserves the original case but is trimmed of whitespace.
    expect(createArg.data.email).toBe('Alice@Example.com')
  })

  it('server-stamps consentGivenAt when caller omits it', async () => {
    const { prisma, spies } = buildPrismaMock({ brand: { memberIdentifierKind: 'EMAIL' } })
    const before = Date.now()
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      enrolledVia: 'MANUAL_API',
    })
    const after = Date.now()

    const createArg = spies.create.mock.calls[0]?.[0] as { data: { consentGivenAt: Date } }
    expect(createArg.data.consentGivenAt).toBeInstanceOf(Date)
    const ts = createArg.data.consentGivenAt.getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('preserves caller-supplied consentGivenAt verbatim on create', async () => {
    const { prisma, spies } = buildPrismaMock({ brand: { memberIdentifierKind: 'EMAIL' } })
    const consentAt = new Date('2024-01-01T00:00:00Z')
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      consentGivenAt: consentAt,
      enrolledVia: 'MANUAL_API',
    })
    const createArg = spies.create.mock.calls[0]?.[0] as { data: { consentGivenAt: Date } }
    expect(createArg.data.consentGivenAt.getTime()).toBe(consentAt.getTime())
  })

  it('R6 idempotent re-enroll — no-op when caller input matches existing row', async () => {
    const existing: Partial<Member> = {
      id: 'm1',
      externalId: 'a@b.com',
      email: 'a@b.com',
      firstName: 'Alice',
      lastName: 'Smith',
      enrolledVia: 'MANUAL_API',
      consentGivenAt: new Date('2024-01-01T00:00:00Z'),
      consentVersion: 'v1',
      emailOptIn: false,
      smsOptIn: false,
      clerkUserId: null,
    }
    const { prisma, spies } = buildPrismaMock({
      brand: { memberIdentifierKind: 'EMAIL' },
      existingMember: existing,
    })

    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      firstName: 'Alice',
      lastName: 'Smith',
      enrolledVia: 'MANUAL_API',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.updatedFields).toEqual([])
    }
    expect(spies.create).not.toHaveBeenCalled()
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('R6 last-write-wins on profile fields; updatedFields lists changes', async () => {
    const existing: Partial<Member> = {
      id: 'm1',
      externalId: 'a@b.com',
      email: 'a@b.com',
      firstName: 'OldFirst',
      lastName: 'OldLast',
      enrolledVia: 'MANUAL_API',
      consentGivenAt: new Date('2024-01-01T00:00:00Z'),
      emailOptIn: false,
      smsOptIn: false,
      clerkUserId: null,
    }
    const { prisma, spies } = buildPrismaMock({
      brand: { memberIdentifierKind: 'EMAIL' },
      existingMember: existing,
      updateReturn: { ...existing, firstName: 'NewFirst', emailOptIn: true } as Member,
    })

    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      firstName: 'NewFirst',
      emailOptIn: true,
      enrolledVia: 'MANUAL_API',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.updatedFields.sort()).toEqual(['emailOptIn', 'firstName'])
    }
    expect(spies.update).toHaveBeenCalledTimes(1)
  })

  it('R6 — does NOT silently rotate consentGivenAt on idempotent re-enroll', async () => {
    // The audit invariant: consentGivenAt only updates if the caller supplies a
    // *new* explicit value. Auto-stamping now() on every re-enroll would erase
    // the original attestation timestamp.
    const existingTs = new Date('2024-01-01T00:00:00Z')
    const existing: Partial<Member> = {
      id: 'm1',
      externalId: 'a@b.com',
      email: 'a@b.com',
      enrolledVia: 'MANUAL_API',
      consentGivenAt: existingTs,
    }
    const { prisma, spies } = buildPrismaMock({
      brand: { memberIdentifierKind: 'EMAIL' },
      existingMember: existing,
    })

    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      enrolledVia: 'MANUAL_API',
      // consentGivenAt absent → must NOT trigger an update
    })

    expect(spies.update).not.toHaveBeenCalled()
  })

  it('case-insensitive lookup: uppercase memberId resolves to existing lowercase externalId', async () => {
    const existing: Partial<Member> = {
      id: 'm1',
      externalId: 'a@b.com',
      email: 'a@b.com',
      enrolledVia: 'MANUAL_API',
      consentGivenAt: new Date(),
    }
    const { prisma, spies } = buildPrismaMock({
      brand: { memberIdentifierKind: 'EMAIL' },
      existingMember: existing,
    })

    const result = await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'A@B.COM',
      enrolledVia: 'MANUAL_API',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.created).toBe(false)
    // Verify findUnique was called with the lowercased key
    const findArg = (prisma.member.findUnique as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      where: { brandId_externalId: { externalId: string } }
    }
    expect(findArg.where.brandId_externalId.externalId).toBe('a@b.com')
    expect(spies.create).not.toHaveBeenCalled()
  })

  it('PHONE brand — sets externalId from E.164 memberId', async () => {
    const { prisma, spies } = buildPrismaMock({ brand: { memberIdentifierKind: 'PHONE' } })
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: '+14155552671',
      enrolledVia: 'MANUAL_API',
    })
    const createArg = spies.create.mock.calls[0]?.[0] as { data: { externalId: string; email: string | null } }
    expect(createArg.data.externalId).toBe('+14155552671')
    // EMAIL sidecar should NOT be auto-derived for PHONE brands.
    expect(createArg.data.email).toBeNull()
  })

  it('SURVEY_RESPONSE auto-enroll — sets enrolledVia from caller', async () => {
    const { prisma, spies } = buildPrismaMock({ brand: { memberIdentifierKind: 'EMAIL' } })
    await resolveOrEnrollMember(prisma, 'brand-1', {
      memberId: 'a@b.com',
      enrolledVia: 'SURVEY_RESPONSE',
    })
    const createArg = spies.create.mock.calls[0]?.[0] as { data: { enrolledVia: string } }
    expect(createArg.data.enrolledVia).toBe('SURVEY_RESPONSE')
  })
})
