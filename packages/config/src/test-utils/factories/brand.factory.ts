import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createBrand(overrides: { name?: string; clerkOrgId?: string } = {}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.brand.create({
    data: {
      clerkOrgId: overrides.clerkOrgId ?? `org_test_${counter}_${Date.now()}`,
      name: overrides.name ?? `Test Brand ${counter}`,
    },
  })
}
