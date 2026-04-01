import type { Prisma } from '@prisma/client'
import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createCampaign(opts: {
  brandId: string
  programId: string
  triggerEventType?: string
  trigger?: { type: string; condition: { field: string; op: string; value: unknown } }
  action?: { type: string; config?: Record<string, unknown>; points?: number }
  name?: string
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  budgetCap?: number | null
  startDate?: Date
  endDate?: Date | null
}) {
  const prisma = getTestPrisma()
  counter++

  // Derive trigger fields: prefer explicit trigger object, fall back to triggerEventType shorthand
  const triggerType = opts.trigger?.type ?? opts.triggerEventType ?? 'cx.nps_submitted'
  const triggerCondition = opts.trigger?.condition ?? { field: 'nps_score', op: 'lt', value: 7 }

  // Derive action fields: prefer explicit action.config, fall back to action.points shorthand
  const actionType = opts.action?.type ?? 'award_points'
  const actionConfig = opts.action?.config ?? { points: opts.action?.points ?? 500 }

  return prisma.campaign.create({
    data: {
      brandId: opts.brandId,
      programId: opts.programId,
      name: opts.name ?? `Test Campaign ${counter}`,
      triggerType,
      triggerCondition: triggerCondition as Prisma.InputJsonValue,
      actionType,
      actionConfig: actionConfig as Prisma.InputJsonValue,
      budgetCap: opts.budgetCap !== undefined ? opts.budgetCap : null,
      status: opts.status ?? 'ACTIVE',
      startDate: opts.startDate ?? new Date(Date.now() - 1000), // started 1 second ago
      endDate: opts.endDate !== undefined ? opts.endDate : null,
    },
  })
}

/**
 * Creates a standard CX NPS campaign that triggers when nps_score < 7 and awards 500 points.
 */
export async function createNpsCampaign(opts: {
  brandId: string
  programId: string
  name?: string
  points?: number
  budgetCap?: number | null
}) {
  return createCampaign({
    brandId: opts.brandId,
    programId: opts.programId,
    triggerEventType: 'cx.nps_submitted',
    action: {
      type: 'award_points',
      points: opts.points ?? 500,
    },
    name: opts.name ?? 'NPS Recovery Campaign',
    budgetCap: opts.budgetCap !== undefined ? opts.budgetCap : null,
  })
}
