import type { Job } from 'bullmq'
import { prisma } from '@customerEQ/database'
import type { Prisma } from '@prisma/client'
import type { LoyaltyEventPayload } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Evaluates all earning rules against a given event and member usage state.
 *
 * Returns an array of { ruleId, points } for each rule that fires so callers
 * can record `rulesApplied` and compute the total in one pass.
 */
export function evaluateRules(
  eventType: string,
  payload: Record<string, unknown>,
  rules: Array<{
    id: string
    triggerEvent: string
    pointsAwarded: number
    multiplier: number
    maxUsesPerMember: number | null
    status: 'ACTIVE' | 'INACTIVE'
  }>,
  memberRuleUsage: Record<string, number>, // ruleId → times used
): number {
  let total = 0

  for (const rule of rules) {
    if (rule.status !== 'ACTIVE') continue
    if (rule.triggerEvent !== eventType) continue

    const usageCount = memberRuleUsage[rule.id] ?? 0
    if (rule.maxUsesPerMember !== null && usageCount >= rule.maxUsesPerMember) continue

    total += Math.round(rule.pointsAwarded * rule.multiplier)
  }

  return total
}

// ---------------------------------------------------------------------------
// Internal variant that also returns per-rule ids for rulesApplied tracking
// ---------------------------------------------------------------------------

function evaluateRulesWithIds(
  eventType: string,
  payload: Record<string, unknown>,
  rules: Array<{
    id: string
    triggerEvent: string
    pointsAwarded: number
    multiplier: number
    maxUsesPerMember: number | null
    status: 'ACTIVE' | 'INACTIVE'
  }>,
  memberRuleUsage: Record<string, number>,
): { ruleId: string; points: number }[] {
  const results: { ruleId: string; points: number }[] = []

  for (const rule of rules) {
    if (rule.status !== 'ACTIVE') continue
    if (rule.triggerEvent !== eventType) continue

    const usageCount = memberRuleUsage[rule.id] ?? 0
    if (rule.maxUsesPerMember !== null && usageCount >= rule.maxUsesPerMember) continue

    results.push({ ruleId: rule.id, points: Math.round(rule.pointsAwarded * rule.multiplier) })
  }

  return results
}

// ---------------------------------------------------------------------------
// BullMQ processor
// ---------------------------------------------------------------------------

export async function processLoyaltyEvent(job: Job<LoyaltyEventPayload>): Promise<{
  pointsAwarded: number
  rulesApplied: string[]
  skipped?: boolean
  reason?: string
}> {
  const { brandId, memberId, eventType, payload, idempotencyKey, ingestedAt } = job.data

  // Idempotency: skip if we have already processed this key
  if (idempotencyKey) {
    const existing = await prisma.loyaltyEvent.findFirst({
      where: { idempotencyKey },
      select: { id: true },
    })
    if (existing) {
      return { pointsAwarded: 0, rulesApplied: [], skipped: true, reason: 'duplicate_idempotency_key' }
    }
  }

  // Fetch active earning rules for all active programs belonging to this brand
  const earningRules = await prisma.earningRule.findMany({
    where: {
      brandId,
      status: 'ACTIVE',
      program: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      triggerEvent: true,
      pointsAwarded: true,
      multiplier: true,
      maxUsesPerMember: true,
      status: true,
    },
  })

  // Build member rule usage map from existing LoyaltyEvents
  const usageRecords = await prisma.loyaltyEvent.findMany({
    where: {
      memberId,
      brandId,
      rulesApplied: { isEmpty: false },
    },
    select: { rulesApplied: true },
  })

  const memberRuleUsage: Record<string, number> = {}
  for (const record of usageRecords) {
    for (const ruleId of record.rulesApplied) {
      memberRuleUsage[ruleId] = (memberRuleUsage[ruleId] ?? 0) + 1
    }
  }

  const firedRules = evaluateRulesWithIds(eventType, payload, earningRules, memberRuleUsage)
  const totalPoints = firedRules.reduce((sum, r) => sum + r.points, 0)
  const rulesApplied = firedRules.map((r) => r.ruleId)

  if (totalPoints > 0) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.loyaltyEvent.create({
        data: {
          brandId,
          memberId,
          eventType,
          pointsEarned: totalPoints,
          payload: payload as Prisma.InputJsonValue,
          idempotencyKey: idempotencyKey ?? null,
          rulesApplied,
        },
      })
      await tx.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: totalPoints } },
      })
    })
  }

  return { pointsAwarded: totalPoints, rulesApplied }
}
