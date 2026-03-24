import type { PrismaClient } from '@prisma/client'

export async function createLoyaltyEvent(
  prisma: PrismaClient,
  brandId: string,
  memberId: string,
  overrides: Partial<{
    eventType: string
    pointsEarned: number
    campaignId: string
    idempotencyKey: string
    rulesApplied: string[]
  }> = {}
) {
  return prisma.loyaltyEvent.create({
    data: {
      brandId,
      memberId,
      eventType: overrides.eventType ?? 'purchase',
      pointsEarned: overrides.pointsEarned ?? 100,
      campaignId: overrides.campaignId ?? null,
      idempotencyKey: overrides.idempotencyKey ?? null,
      rulesApplied: overrides.rulesApplied ?? [],
    },
  })
}

/**
 * Creates a CX event payload object (not persisted — used for POST /v1/events body)
 */
export function createCxEvent(type: string, score: number, memberId?: string) {
  return {
    eventType: type,
    memberId: memberId ?? 'placeholder_member_id',
    payload: {
      nps_score: score,
      survey_id: 'survey_test_001',
    },
    idempotencyKey: `${type}_${score}_${Date.now()}`,
  }
}
