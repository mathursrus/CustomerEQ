import type { Job, ConnectionOptions } from 'bullmq'
import { prisma } from '@customerEQ/database'
import type { Prisma } from '@prisma/client'
import type { LoyaltyEventPayload } from '@customerEQ/shared'
import { PUBLIC_API_URL, evaluateConditions } from '@customerEQ/shared'
import type { ConditionGroup } from '@customerEQ/shared'
import { enqueueSurveyDistribute } from '../queues/producers.js'

// ---------------------------------------------------------------------------
// Issue #117: Loyalty event → survey trigger mapping
// Maps from LoyaltyEvent.eventType to the triggerKey(s) used on Survey records.
// Scheduled triggers (quarterly_pulse etc.) are not event-driven — excluded here.
// ---------------------------------------------------------------------------

export const EVENT_TO_TRIGGER_KEYS: Record<string, string[]> = {
  'tier.upgraded':      ['tier_upgrade'],
  'redemption.first':   ['first_redemption'],
  'purchase':           ['5th_purchase'],
  'member.enrolled':    ['enrollment'],
  'member.anniversary': ['anniversary'],
  'member.inactive':    ['inactive_30d'],
  'cx.support_closed':  ['after_support'],
  'cx.nps_drop':        ['nps_drop'],
}

const SURVEY_DISTRIBUTE_COOLDOWN_DAYS = 30
// Issue #540 — Fall back to the canonical PUBLIC_API_URL constant instead
// of localhost. Worker has no env var set in prod today; this used to
// dispatch outbound webhooks at http://localhost:4000 from a Container App.
const API_BASE_URL = process.env.API_BASE_URL ?? PUBLIC_API_URL

// Re-export so existing test imports continue to work
export { evaluateConditions }
export type { ConditionGroup }

/**
 * Evaluates all earning rules against a given event and member usage state.
 *
 * Returns an array of { ruleId, points } for each rule that fires so callers
 * can record `rulesApplied` and compute the total in one pass.
 *
 * Rules are evaluated in priority order (ascending). Non-stackable rules block
 * subsequent non-stackable rules once the first match is found. Stackable rules
 * always apply regardless of other matches.
 */
export function evaluateRulesWithIds(
  eventType: string,
  payload: Record<string, unknown>,
  rules: Array<{
    id: string
    triggerEvent: string
    pointsAwarded: number
    multiplier: number
    maxUsesPerMember: number | null
    status: 'ACTIVE' | 'INACTIVE'
    priority: number
    stackable: boolean
    conditions: ConditionGroup | null
    budgetCapPoints: number | null
    budgetUsedPoints: number
  }>,
  memberRuleUsage: Record<string, number>,
  programBudget: {
    budgetUsdCents: number
    budgetSpentCents: number
    pointToCurrencyRatio: number
  } | null,
): { ruleId: string; points: number }[] {
  // Check program-level budget cap before evaluating any rules
  if (programBudget !== null) {
    if (programBudget.budgetSpentCents >= programBudget.budgetUsdCents) {
      return []
    }
  }

  // Sort rules by priority ascending (lower number = evaluated first)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)

  const results: { ruleId: string; points: number }[] = []
  let firstMatchSeen = false

  for (const rule of sorted) {
    if (rule.status !== 'ACTIVE') continue
    if (rule.triggerEvent !== eventType) continue

    // Skip rules beyond the first non-stackable match
    if (firstMatchSeen && !rule.stackable) continue

    // Per-rule budget cap check
    if (rule.budgetCapPoints !== null && rule.budgetUsedPoints >= rule.budgetCapPoints) continue

    // maxUsesPerMember check
    const usageCount = memberRuleUsage[rule.id] ?? 0
    if (rule.maxUsesPerMember !== null && usageCount >= rule.maxUsesPerMember) continue

    // Condition evaluation
    if (!evaluateConditions(rule.conditions as ConditionGroup | null, payload)) continue

    const points = Math.round(rule.pointsAwarded * rule.multiplier)
    results.push({ ruleId: rule.id, points })

    if (!rule.stackable) {
      firstMatchSeen = true
    }
  }

  return results
}

/**
 * Legacy all-fire rule evaluator. All matching ACTIVE rules fire and points are
 * summed. Kept for backward compatibility with existing tests and callers.
 * New code should use evaluateRulesWithIds for priority + stackable semantics.
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
  memberRuleUsage: Record<string, number>,
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
// BullMQ processor factory — Issue #117: accepts connection for survey distribution
// ---------------------------------------------------------------------------

export function createLoyaltyEventProcessor(connection: ConnectionOptions) {
  return async function processLoyaltyEvent(job: Job<LoyaltyEventPayload>): Promise<{
    pointsAwarded: number
    rulesApplied: string[]
    skipped?: boolean
    reason?: string
  }> {
    return _processLoyaltyEvent(job, connection)
  }
}

// Keep the non-factory export for backwards compatibility with existing tests
// (tests import processLoyaltyEvent as a named function)
export async function processLoyaltyEvent(job: Job<LoyaltyEventPayload>): Promise<{
  pointsAwarded: number
  rulesApplied: string[]
  skipped?: boolean
  reason?: string
}> {
  return _processLoyaltyEvent(job, null)
}

async function _processLoyaltyEvent(
  job: Job<LoyaltyEventPayload>,
  connection: ConnectionOptions | null,
): Promise<{
  pointsAwarded: number
  rulesApplied: string[]
  skipped?: boolean
  reason?: string
}> {
  const { brandId, memberId, eventType, payload, idempotencyKey } = job.data

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
      priority: true,
      stackable: true,
      conditions: true,
      budgetCapPoints: true,
      budgetUsedPoints: true,
      program: {
        select: {
          id: true,
          budgetUsdCents: true,
          budgetSpentCents: true,
          pointToCurrencyRatio: true,
        },
      },
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

  // Program-level budget cap enforced per-program in Issue #4; using null here
  // to process across all active programs. Per-rule budgetCapPoints IS enforced.
  const firedRules = evaluateRulesWithIds(
    eventType,
    payload,
    earningRules.map((r) => ({
      ...r,
      conditions: r.conditions as ConditionGroup | null,
    })),
    memberRuleUsage,
    null,
  )
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
  } else if (eventType === 'purchase' && firedRules.length === 0) {
    // R6: purchase received but no earning rule matched — log for audit and history display.
    // No balance update since pointsEarned === 0.
    await prisma.loyaltyEvent.create({
      data: {
        brandId,
        memberId,
        eventType,
        pointsEarned: 0,
        payload: payload as Prisma.InputJsonValue,
        idempotencyKey: idempotencyKey ?? null,
        rulesApplied: [],
      },
    })
  }

  // Issue #117: Check for active triggered surveys matching this event type.
  // Fire-and-forget — survey distribution failure must never affect loyalty processing.
  if (connection) {
    void enqueueSurveyDistributionsForEvent(connection, brandId, memberId, eventType)
  }

  return { pointsAwarded: totalPoints, rulesApplied }
}

// ---------------------------------------------------------------------------
// Issue #117: Survey trigger distribution
// ---------------------------------------------------------------------------

async function enqueueSurveyDistributionsForEvent(
  connection: ConnectionOptions,
  brandId: string,
  memberId: string,
  eventType: string,
): Promise<void> {
  const triggerKeys = EVENT_TO_TRIGGER_KEYS[eventType]
  if (!triggerKeys || triggerKeys.length === 0) return

  // Find active surveys for this brand with any of the matching trigger keys
  const surveys = await prisma.survey.findMany({
    where: {
      brandId,
      status: 'ACTIVE',
      triggerKey: { in: triggerKeys },
    },
    select: { id: true, triggerKey: true },
  })
  if (surveys.length === 0) return

  const now = new Date()
  const cooldownCutoff = new Date(now)
  cooldownCutoff.setDate(cooldownCutoff.getDate() - SURVEY_DISTRIBUTE_COOLDOWN_DAYS)

  for (const survey of surveys) {
    // Cooldown check: skip if already distributed to this member within cooldown window
    const recentDistribution = await prisma.surveyDistribution.findFirst({
      where: {
        surveyId: survey.id,
        memberId,
        sentAt: { gte: cooldownCutoff },
      },
      select: { id: true },
    })
    if (recentDistribution) continue

    const surveyLink = `${API_BASE_URL}/survey/${survey.id}`
    await enqueueSurveyDistribute(connection, {
      surveyId: survey.id,
      memberId,
      brandId,
      triggerKey: survey.triggerKey ?? eventType,
      surveyLink,
      cooldownDays: SURVEY_DISTRIBUTE_COOLDOWN_DAYS,
    })
  }
}
