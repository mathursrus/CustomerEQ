import type { PrismaClient } from '@prisma/client'

export async function createRedemption(
  prisma: PrismaClient,
  brandId: string,
  memberId: string,
  rewardId: string,
  pointsSpent: number
) {
  return prisma.redemption.create({
    data: {
      brandId,
      memberId,
      rewardId,
      pointsSpent,
      status: 'FULFILLED',
    },
  })
}
