import type { PrismaClient } from '@prisma/client'

let counter = 0

export async function createProgram(
  prisma: PrismaClient,
  brandId: string,
  overrides: Partial<{
    name: string
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
    pointCurrencyName: string
    pointToCurrencyRatio: number
  }> = {}
) {
  counter++
  return prisma.program.create({
    data: {
      brandId,
      name: overrides.name ?? `Test Program ${counter}`,
      pointCurrencyName: overrides.pointCurrencyName ?? 'Points',
      pointToCurrencyRatio: overrides.pointToCurrencyRatio ?? 0.01,
      status: overrides.status ?? 'ACTIVE',
    },
  })
}

export async function createProgramWithRules(
  prisma: PrismaClient,
  brandId: string,
  rules: Array<{ triggerEvent: string; pointsAwarded: number; multiplier?: number }>
) {
  const program = await createProgram(prisma, brandId, { status: 'ACTIVE' })
  const earningRules = await Promise.all(
    rules.map((rule) =>
      prisma.earningRule.create({
        data: {
          brandId,
          programId: program.id,
          name: `Rule for ${rule.triggerEvent}`,
          triggerEvent: rule.triggerEvent,
          pointsAwarded: rule.pointsAwarded,
          multiplier: rule.multiplier ?? 1.0,
          status: 'ACTIVE',
        },
      })
    )
  )
  return { program, earningRules }
}
