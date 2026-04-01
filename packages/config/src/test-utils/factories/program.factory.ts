import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createProgram(opts: {
  brandId: string
  name?: string
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  type?: 'POINTS' | 'TIERED' | 'CASHBACK' | 'HYBRID'
  pointCurrencyName?: string
  pointToCurrencyRatio?: number
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.program.create({
    data: {
      brandId: opts.brandId,
      name: opts.name ?? `Test Program ${counter}`,
      type: opts.type ?? 'POINTS',
      pointCurrencyName: opts.pointCurrencyName ?? 'Points',
      pointToCurrencyRatio: opts.pointToCurrencyRatio ?? 0.01,
      status: opts.status ?? 'ACTIVE',
    },
  })
}

export async function createProgramWithRules(opts: {
  brandId: string
  rules: Array<{ triggerEvent: string; pointsAwarded: number; multiplier?: number }>
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  name?: string
}) {
  const prisma = getTestPrisma()
  const program = await createProgram({ brandId: opts.brandId, status: opts.status ?? 'ACTIVE', name: opts.name })
  const earningRules = await Promise.all(
    opts.rules.map((rule) =>
      prisma.earningRule.create({
        data: {
          brandId: opts.brandId,
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

export async function createTier(opts: {
  brandId: string
  programId: string
  name?: string
  rank?: number
  icon?: string
  minPoints?: number
  minSpendCents?: number
  benefits?: string[]
  multiplier?: number
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.tier.create({
    data: {
      brandId: opts.brandId,
      programId: opts.programId,
      name: opts.name ?? `Tier ${counter}`,
      rank: opts.rank ?? counter,
      icon: opts.icon ?? undefined,
      minPoints: opts.minPoints ?? undefined,
      minSpendCents: opts.minSpendCents ?? undefined,
      benefits: opts.benefits ?? [],
      multiplier: opts.multiplier ?? 1.0,
    },
  })
}
