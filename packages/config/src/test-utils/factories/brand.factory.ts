import type { PrismaClient } from '@prisma/client'

let counter = 0

export async function createBrand(prisma: PrismaClient, overrides: { name?: string; clerkOrgId?: string } = {}) {
  counter++
  return prisma.brand.create({
    data: {
      clerkOrgId: overrides.clerkOrgId ?? `org_test_${counter}_${Date.now()}`,
      name: overrides.name ?? `Test Brand ${counter}`,
    },
  })
}
