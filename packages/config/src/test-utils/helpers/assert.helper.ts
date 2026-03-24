import type { PrismaClient } from '@prisma/client'
import { expect } from 'vitest'

/**
 * Asserts that a member has the expected points balance in the database.
 */
export async function toHavePointsBalance(
  prisma: PrismaClient,
  memberId: string,
  expectedBalance: number
): Promise<void> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } })
  expect(member.pointsBalance).toBe(expectedBalance)
}

/**
 * Asserts that a Redemption record exists for the given member and reward.
 */
export async function toHaveRedemption(
  prisma: PrismaClient,
  memberId: string,
  rewardId: string
): Promise<void> {
  const redemption = await prisma.redemption.findFirst({
    where: { memberId, rewardId },
  })
  expect(redemption).not.toBeNull()
}

/**
 * Asserts that exactly N LoyaltyEvents of the given type exist for the member.
 */
export async function toHaveLoyaltyEventCount(
  prisma: PrismaClient,
  memberId: string,
  eventType: string,
  expectedCount: number
): Promise<void> {
  const count = await prisma.loyaltyEvent.count({ where: { memberId, eventType } })
  expect(count).toBe(expectedCount)
}
