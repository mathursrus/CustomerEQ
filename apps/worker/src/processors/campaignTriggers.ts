import type { Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { prisma } from '@customerEQ/database'
import type { Prisma } from '@prisma/client'
import type { CampaignTriggerPayload, SpinWheelConfig, ScratchCardConfig, MysteryBoxConfig } from '@customerEQ/shared'
import { selectWeightedRandom } from '@customerEQ/shared/random'
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

    const latencyMs = Date.now() - new Date(eventIngestedAt).getTime()

    // 3. Route by action type
    if (campaign.actionType === 'spin_wheel' || campaign.actionType === 'scratch_card' || campaign.actionType === 'mystery_box') {
      return await executeInteractiveCampaign(campaign, memberId, brandId, latencyMs, redis)
    }

    // 3b. Check budget cap (standard action types)
    if (campaign.budgetCap !== null) {
      const points = (campaign.actionConfig as { points?: number }).points ?? 0
      const actionCostUsd = points * campaign.program.pointToCurrencyRatio
      if (campaign.budgetSpent + actionCostUsd > campaign.budgetCap) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } })
        return { skipped: true, reason: 'budget_cap_reached' }
      }
    }

    // 4. Execute standard action in transaction
    const points = (campaign.actionConfig as { points?: number }).points ?? 0

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

// ---------------------------------------------------------------------------
// Interactive campaign handler (spin_wheel + scratch_card)
// ---------------------------------------------------------------------------

async function executeInteractiveCampaign(
  campaign: {
    id: string
    actionType: string
    actionConfig: unknown
    budgetCap: number | null
    budgetSpent: number
    program: { pointToCurrencyRatio: number }
  },
  memberId: string,
  brandId: string,
  latencyMs: number,
  redis: Redis,
): Promise<{ executed?: boolean; skipped?: boolean; reason?: string; points?: number; latencyMs?: number }> {
  // Get the prize/segment array based on campaign type
  const items = campaign.actionType === 'spin_wheel'
    ? (campaign.actionConfig as SpinWheelConfig).segments
    : campaign.actionType === 'scratch_card'
      ? (campaign.actionConfig as ScratchCardConfig).prizes
      : (campaign.actionConfig as MysteryBoxConfig).prizes
  const winningItem = selectWeightedRandom(items)
  const winningIndex = items.indexOf(winningItem)
  const points = winningItem.points ?? 0

  // Budget check
  if (campaign.budgetCap !== null) {
    const costUsd = points * campaign.program.pointToCurrencyRatio
    if (campaign.budgetSpent + costUsd > campaign.budgetCap) {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } })
      return { skipped: true, reason: 'budget_cap_reached' }
    }
  }

  const result = {
    winningIndex,
    rewardId: winningItem.rewardId ?? null,
    points,
    label: winningItem.label,
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create CampaignEvent with result
    await tx.campaignEvent.create({
      data: {
        campaignId: campaign.id,
        memberId,
        brandId,
        executedAt: new Date(),
        latencyMs,
        status: 'executed',
        result,
      },
    })

    // Award points if applicable
    if (points > 0) {
      await tx.loyaltyEvent.create({
        data: {
          memberId,
          brandId,
          eventType: 'campaign_award',
          pointsEarned: points,
          campaignId: campaign.id,
          rulesApplied: [],
        },
      })
      await tx.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: points } },
      })
    }

    // Create redemption if reward-based
    if (winningItem.rewardId) {
      await tx.redemption.create({
        data: {
          memberId,
          rewardId: winningItem.rewardId,
          brandId,
          pointsSpent: 0,
          status: 'PENDING',
        },
      })
      await tx.reward.updateMany({
        where: { id: winningItem.rewardId, stock: { not: null } },
        data: { stock: { decrement: 1 } },
      })
    }

    // Update budget
    const costUsd = points * campaign.program.pointToCurrencyRatio
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { budgetSpent: { increment: costUsd } },
    })
  })

  // Notify member they earned a spin
  await enqueueNotification(redis, {
    memberId,
    brandId,
    message: 'You earned a spin! Tap to play.',
    channel: 'email',
  })

  return { executed: true, points, latencyMs }
}
