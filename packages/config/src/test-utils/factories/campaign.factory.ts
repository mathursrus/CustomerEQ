import type { PrismaClient } from '@prisma/client'

let counter = 0

export async function createCampaign(
  prisma: PrismaClient,
  brandId: string,
  programId: string,
  trigger: { type: string; condition: { field: string; op: string; value: unknown } },
  action: { type: string; config: Record<string, unknown> },
  overrides: Partial<{
    name: string
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
    budgetCap: number | null
    startDate: Date
    endDate: Date | null
  }> = {}
) {
  counter++
  return prisma.campaign.create({
    data: {
      brandId,
      programId,
      name: overrides.name ?? `Test Campaign ${counter}`,
      triggerType: trigger.type,
      triggerCondition: trigger.condition,
      actionType: action.type,
      actionConfig: action.config,
      budgetCap: overrides.budgetCap !== undefined ? overrides.budgetCap : null,
      status: overrides.status ?? 'ACTIVE',
      startDate: overrides.startDate ?? new Date(Date.now() - 1000), // started 1 second ago
      endDate: overrides.endDate !== undefined ? overrides.endDate : null,
    },
  })
}

/**
 * Creates a standard CX NPS campaign that triggers when nps_score < 7 and awards 500 points.
 */
export async function createNpsCampaign(
  prisma: PrismaClient,
  brandId: string,
  programId: string,
  overrides: Partial<{ name: string; points: number; budgetCap: number | null }> = {}
) {
  return createCampaign(
    prisma,
    brandId,
    programId,
    {
      type: 'cx.nps_submitted',
      condition: { field: 'nps_score', op: 'lt', value: 7 },
    },
    {
      type: 'award_points',
      config: { points: overrides.points ?? 500 },
    },
    {
      name: overrides.name ?? 'NPS Recovery Campaign',
      budgetCap: overrides.budgetCap !== undefined ? overrides.budgetCap : null,
    }
  )
}
