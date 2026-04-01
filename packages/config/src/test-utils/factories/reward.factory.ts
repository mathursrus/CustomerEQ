import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createReward(opts: {
  brandId: string
  programId: string
  name?: string
  pointsCost?: number
  stock?: number | null
  isAvailable?: boolean
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.reward.create({
    data: {
      brandId: opts.brandId,
      programId: opts.programId,
      name: opts.name ?? `Test Reward ${counter}`,
      pointsCost: opts.pointsCost ?? 500,
      stock: opts.stock !== undefined ? opts.stock : null,
      isAvailable: opts.isAvailable !== undefined ? opts.isAvailable : true,
    },
  })
}
