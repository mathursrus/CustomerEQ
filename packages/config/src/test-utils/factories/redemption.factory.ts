import { getTestPrisma } from '../db/setup.js'

export async function createRedemption(opts: {
  brandId: string
  memberId: string
  rewardId: string
  pointsSpent: number
  status?: 'PENDING' | 'FULFILLED' | 'CANCELLED'
}) {
  const prisma = getTestPrisma()
  return prisma.redemption.create({
    data: {
      brandId: opts.brandId,
      memberId: opts.memberId,
      rewardId: opts.rewardId,
      pointsSpent: opts.pointsSpent,
      status: opts.status ?? 'FULFILLED',
    },
  })
}
