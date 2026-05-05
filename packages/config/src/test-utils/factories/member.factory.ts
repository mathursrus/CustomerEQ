import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createMember(opts: {
  brandId: string
  programId?: string // accepted for caller convenience but not stored on Member
  email?: string
  externalId?: string // Issue #231 — defaults to LOWER(TRIM(email)) to match the migration backfill
  enrolledVia?: 'MANUAL_API' | 'BULK_IMPORT' | 'SURVEY_RESPONSE' | 'EMBEDDED_FORM' | 'CLERK_OAUTH'
  firstName?: string
  lastName?: string
  pointsBalance?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'ERASED'
  consentGivenAt?: Date | null
}) {
  const prisma = getTestPrisma()
  counter++
  const email = opts.email ?? `member_${counter}_${Date.now()}@test.com`
  return prisma.member.create({
    data: {
      brandId: opts.brandId,
      email,
      externalId: opts.externalId ?? email.trim().toLowerCase(),
      enrolledVia: opts.enrolledVia ?? 'MANUAL_API',
      firstName: opts.firstName ?? `First${counter}`,
      lastName: opts.lastName ?? `Last${counter}`,
      pointsBalance: opts.pointsBalance ?? 0,
      status: opts.status ?? 'ACTIVE',
      consentGivenAt: opts.consentGivenAt !== undefined ? opts.consentGivenAt : null,
    },
  })
}

export async function createConsentedMember(opts: {
  brandId: string
  programId?: string // accepted for caller convenience but not stored on Member
  email?: string
  firstName?: string
  lastName?: string
  pointsBalance?: number
}) {
  return createMember({
    ...opts,
    consentGivenAt: new Date(),
    status: 'ACTIVE',
  })
}

/**
 * Creates a member marked as erased (GDPR/CCPA) for PII masking tests.
 */
export async function createErasedMember(opts: {
  brandId: string
  email?: string
  firstName?: string
  lastName?: string
}) {
  const prisma = getTestPrisma()
  counter++
  const email = opts.email ?? `erased_${counter}_${Date.now()}@test.com`
  return prisma.member.create({
    data: {
      brandId: opts.brandId,
      email,
      externalId: email.trim().toLowerCase(),  // Issue #231 — matches migration backfill
      enrolledVia: 'MANUAL_API',
      firstName: opts.firstName ?? `ErasedFirst${counter}`,
      lastName: opts.lastName ?? `ErasedLast${counter}`,
      pointsBalance: 0,
      status: 'ERASED',
      erased: true,
      consentGivenAt: new Date(),
    },
  })
}
