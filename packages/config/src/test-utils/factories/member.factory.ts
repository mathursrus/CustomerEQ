import type { PrismaClient } from '@prisma/client'

let counter = 0

export async function createMember(
  prisma: PrismaClient,
  brandId: string,
  overrides: Partial<{
    email: string
    firstName: string
    lastName: string
    pointsBalance: number
    status: 'ACTIVE' | 'INACTIVE' | 'ERASED'
    consentGivenAt: Date | null
  }> = {}
) {
  counter++
  return prisma.member.create({
    data: {
      brandId,
      email: overrides.email ?? `member_${counter}_${Date.now()}@test.com`,
      firstName: overrides.firstName ?? `First${counter}`,
      lastName: overrides.lastName ?? `Last${counter}`,
      pointsBalance: overrides.pointsBalance ?? 0,
      status: overrides.status ?? 'ACTIVE',
      consentGivenAt: overrides.consentGivenAt !== undefined ? overrides.consentGivenAt : null,
    },
  })
}

export async function createConsentedMember(
  prisma: PrismaClient,
  brandId: string,
  overrides: Partial<{
    email: string
    firstName: string
    lastName: string
    pointsBalance: number
  }> = {}
) {
  return createMember(prisma, brandId, {
    ...overrides,
    consentGivenAt: new Date(),
    status: 'ACTIVE',
  })
}
