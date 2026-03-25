import type { Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { prisma } from '@customerEQ/database'
import type { Prisma } from '@prisma/client'
import type { CampaignTriggerPayload } from '@customerEQ/shared'
import { enqueueNotification } from '../queues/producers.js'

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing and api fast-path
// ---------------------------------------------------------------------------

export function evaluateTriggerCondition(
  condition: { field: string; op: string; value: unknown },
  payload: Record<string, unknown>,
): boolean {
  const actual = payload[condition.field]
  switch (condition.op) {
    case 'eq':
      return actual === condition.value
    case 'ne':
      return actual !== condition.value
    case 'lt':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual < condition.value
      )
    case 'lte':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual <= condition.value
      )
    case 'gt':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual > condition.value
      )
    case 'gte':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual >= condition.value
      )
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof condition.value === 'string' &&
        actual.includes(condition.value)
      )
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// BullMQ processor — must be called with a bound redis instance
// ---------------------------------------------------------------------------

export function createCampaignTriggerProcessor(redis: Redis) {
  return async function processCampaignTrigger(
    job: Job<CampaignTriggerPayload>,
  ): Promise<{ executed?: boolean; skipped?: boolean; reason?: string; points?: number; latencyMs?: number }> {
    const { campaignId, memberId, brandId, eventIngestedAt } = job.data

    // 1. Redis dedup SET NX
    const dedupKey = `campaign:dedup:${campaignId}:${memberId}`
    const isNew = await redis.set(dedupKey, '1', 'NX')
    if (!isNew) return { skipped: true, reason: 'already_triggered' }

    // 2. Fetch campaign
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { program: { select: { pointToCurrencyRatio: true } } },
    })
    if (campaign.status !== 'ACTIVE') return { skipped: true, reason: 'campaign_inactive' }

    // 3. Check budget cap
    if (campaign.budgetCap !== null) {
      const points = (campaign.actionConfig as { points?: number }).points ?? 0
      const actionCostUsd = points * campaign.program.pointToCurrencyRatio
      if (campaign.budgetSpent + actionCostUsd > campaign.budgetCap) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } })
        return { skipped: true, reason: 'budget_cap_reached' }
      }
    }

    // 4. Execute action in transaction
    const points = (campaign.actionConfig as { points?: number }).points ?? 0
    const latencyMs = Date.now() - new Date(eventIngestedAt).getTime()

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.loyaltyEvent.create({
        data: {
          memberId,
          brandId,
          eventType: 'campaign_award',
          pointsEarned: points,
          campaignId,
          rulesApplied: [],
        },
      })
      await tx.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: points } },
      })
      await tx.campaignEvent.create({
        data: {
          campaignId,
          memberId,
          brandId,
          executedAt: new Date(),
          latencyMs,
          status: 'executed',
        },
      })
      const costUsd = points * campaign.program.pointToCurrencyRatio
      await tx.campaign.update({
        where: { id: campaignId },
        data: { budgetSpent: { increment: costUsd } },
      })
    })

    // 5. Enqueue notification if message configured
    const actionMessage = (campaign.actionConfig as { message?: string }).message
    if (actionMessage) {
      await enqueueNotification(redis, { memberId, brandId, message: actionMessage, channel: 'email' })
    }

    return { executed: true, points, latencyMs }
  }
}
