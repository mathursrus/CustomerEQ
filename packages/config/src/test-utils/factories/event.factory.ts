import { getTestPrisma } from '../db/setup.js'

export async function createLoyaltyEvent(opts: {
  brandId: string
  memberId: string
  eventType?: string
  pointsEarned?: number
  campaignId?: string
  idempotencyKey?: string
  rulesApplied?: string[]
}) {
  const prisma = getTestPrisma()
  return prisma.loyaltyEvent.create({
    data: {
      brandId: opts.brandId,
      memberId: opts.memberId,
      eventType: opts.eventType ?? 'purchase',
      pointsEarned: opts.pointsEarned ?? 100,
      campaignId: opts.campaignId ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      rulesApplied: opts.rulesApplied ?? [],
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
