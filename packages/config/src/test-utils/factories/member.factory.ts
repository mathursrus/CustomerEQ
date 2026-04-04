import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createMember(opts: {
  brandId: string
  programId?: string // accepted for caller convenience but not stored on Member
  email?: string
  firstName?: string
  lastName?: string
  pointsBalance?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'ERASED'
  consentGivenAt?: Date | null
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.member.create({
    data: {
      brandId: opts.brandId,
      email: opts.email ?? `member_${counter}_${Date.now()}@test.com`,
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
  return prisma.member.create({
    data: {
      brandId: opts.brandId,
      email: opts.email ?? `erased_${counter}_${Date.now()}@test.com`,
      firstName: opts.firstName ?? `ErasedFirst${counter}`,
      lastName: opts.lastName ?? `ErasedLast${counter}`,
      pointsBalance: 0,
      status: 'ERASED',
      erased: true,
      consentGivenAt: new Date(),
    },
  })
}
