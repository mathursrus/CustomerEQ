import type { PrismaClient } from '@prisma/client'

let counter = 0

export async function createReward(
  prisma: PrismaClient,
  brandId: string,
  programId: string,
  overrides: Partial<{
    name: string
    pointsCost: number
    stock: number | null
    isAvailable: boolean
  }> = {}
) {
  counter++
  return prisma.reward.create({
    data: {
      brandId,
      programId,
      name: overrides.name ?? `Test Reward ${counter}`,
      pointsCost: overrides.pointsCost ?? 500,
      stock: overrides.stock !== undefined ? overrides.stock : null,
      isAvailable: overrides.isAvailable !== undefined ? overrides.isAvailable : true,
    },
  })
}
