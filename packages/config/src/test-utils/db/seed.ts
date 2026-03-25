import type { PrismaClient } from '@prisma/client'

export interface SeedResult {
  brand: { id: string; clerkOrgId: string; name: string }
  program: { id: string; name: string; status: string }
  earningRule: { id: string; triggerEvent: string; pointsAwarded: number }
}

/**
 * Seeds the test database with 1 brand, 1 active program, and 1 earning rule.
 * Call in beforeEach() to get a clean state for each test.
 */
export async function seedTestDb(prisma: PrismaClient): Promise<SeedResult> {
  // Clean all tenant data in order (foreign key safe)
  await prisma.auditEvent.deleteMany()
  await prisma.campaignEvent.deleteMany()
  await prisma.loyaltyEvent.deleteMany()
  await prisma.redemption.deleteMany()
  await prisma.reward.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.earningRule.deleteMany()
  await prisma.member.deleteMany()
  await prisma.program.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.demoRequest.deleteMany()

  const brand = await prisma.brand.create({
    data: { clerkOrgId: 'org_test_seed', name: 'Test Brand' },
  })

  const program = await prisma.program.create({
    data: {
      brandId: brand.id,
      name: 'Test Loyalty Program',
      pointCurrencyName: 'Points',
      pointToCurrencyRatio: 0.01,
      status: 'ACTIVE',
    },
  })

  const earningRule = await prisma.earningRule.create({
    data: {
      brandId: brand.id,
      programId: program.id,
      name: 'Purchase Points',
      triggerEvent: 'purchase',
      pointsAwarded: 100,
      multiplier: 1.0,
      status: 'ACTIVE',
    },
  })

  return {
    brand: { id: brand.id, clerkOrgId: brand.clerkOrgId, name: brand.name },
    program: { id: program.id, name: program.name, status: program.status },
    earningRule: { id: earningRule.id, triggerEvent: earningRule.triggerEvent, pointsAwarded: earningRule.pointsAwarded },
  }
}
