// Pure mappers that translate API program payloads (from GET /v1/programs/:id)
// into the client-side WizardState shape consumed by `ProgramWizard`.
//
// These helpers live in their own module so they can be unit-tested without
// pulling in React or Next.js client components.

import type { WizardState, ProgramType, EarningRule, Tier, Reward, Condition } from './program-wizard'

// ── API shapes (from GET /v1/programs/:id) ───────────────────────────────────

export interface ApiConditionGroup {
  operator: 'AND' | 'OR'
  conditions: Array<{ field: string; op: string; value: unknown }>
}

export interface ApiEarningRule {
  id: string
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
  conditions: ApiConditionGroup | null
  priority: number
  stackable: boolean
  budgetCapPoints: number | null
}

export interface ApiTier {
  id: string
  name: string
  icon: string | null
  minPoints: number | null
  minSpendCents: number | null
  multiplier: number
  benefits: string[]
}

export interface ApiReward {
  id: string
  name: string
  description: string | null
  type: string | null
  pointsCost: number
  stock: number | null
  availableFrom: string | null
  availableTo: string | null
  eligibleTierIds: string[]
}

export interface ApiProgram {
  id: string
  name: string
  description: string | null
  type?: string
  status: string
  startDate: string | null
  endDate: string | null
  pointCurrencyName: string
  budgetUsdCents: number | null
  earningRules?: ApiEarningRule[]
  tiers?: ApiTier[]
  rewards?: ApiReward[]
}

// ── Op code translation (API → frontend display symbols) ────────────────────

const OP_MAP: Record<string, string> = {
  eq: '=',
  ne: '≠',
  gte: '≥',
  lte: '≤',
  gt: '>',
  lt: '<',
}

function mapOp(op: string): string {
  return OP_MAP[op] ?? op
}

// ── Field mappers ────────────────────────────────────────────────────────────

function randomId(): string {
  // `crypto.randomUUID` exists in Node 19+, modern browsers, and vitest's node env.
  // Fall back for any exotic environments.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cond-${Math.random().toString(36).slice(2, 10)}`
}

export function mapEarningRule(r: ApiEarningRule): EarningRule {
  const conditions: Condition[] = (r.conditions?.conditions ?? []).map((c) => ({
    id: randomId(),
    field: c.field,
    op: mapOp(c.op),
    value: String(c.value ?? ''),
  }))

  const isMultiplier = r.multiplier !== 1.0
  return {
    id: r.id,
    trigger: r.triggerEvent,
    conditions,
    conditionLogic: r.conditions?.operator ?? 'AND',
    action: isMultiplier ? 'MULTIPLIER' : 'AWARD_POINTS',
    actionValue: isMultiplier ? String(r.multiplier) : String(r.pointsAwarded),
    budgetCapPoints: r.budgetCapPoints != null ? String(r.budgetCapPoints) : '',
    priority: r.priority,
    stackable: r.stackable,
  }
}

export function mapTier(t: ApiTier): Tier {
  return {
    id: t.id,
    name: t.name,
    icon: t.icon ?? '🥉',
    minPoints: t.minPoints != null ? String(t.minPoints) : '0',
    minSpend: t.minSpendCents != null ? String(t.minSpendCents / 100) : '',
    multiplier: `${t.multiplier}×`,
    benefits: t.benefits.join('\n'),
  }
}

/**
 * Resolve an API reward into the WizardState reward shape.
 *
 * `eligibleTierIds` comes from the API as an array of tier IDs; the wizard's
 * view layer (Step5Rewards) expects a human-readable string in
 * `reward.eligibleTiers`. An empty array means the reward is available to all
 * tiers, so we render the "All Tiers" sentinel that Step5Rewards already
 * falls back to.
 *
 * Unknown tier IDs (tier IDs not present on the program at read time) are
 * filtered out defensively — if nothing resolves, we fall back to "All Tiers"
 * rather than displaying a blank string.
 */
export function mapReward(r: ApiReward, tiers: ApiTier[] = []): Reward {
  const hasDateRange = r.availableFrom != null || r.availableTo != null

  const tierNameById = new Map(tiers.map((t) => [t.id, t.name]))
  const resolvedNames = (r.eligibleTierIds ?? [])
    .map((id) => tierNameById.get(id))
    .filter((name): name is string => typeof name === 'string' && name.length > 0)

  const eligibleTiers =
    resolvedNames.length > 0 ? resolvedNames.join(', ') : 'All Tiers'

  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    rewardType: r.type ?? 'Discount Code',
    pointsCost: String(r.pointsCost),
    stock: r.stock != null ? 'LIMITED' : 'UNLIMITED',
    stockQty: r.stock != null ? String(r.stock) : '',
    eligibleTiers,
    availability: hasDateRange ? 'DATES' : 'ALWAYS',
    availFrom: r.availableFrom ? r.availableFrom.split('T')[0] : '',
    availUntil: r.availableTo ? r.availableTo.split('T')[0] : '',
  }
}

// ── Currency helpers ─────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = ['Stars', 'Points', 'Coins', 'Miles', 'Credits', 'Sparks', 'Cash Back']

export function mapProgramToState(program: ApiProgram): Partial<WizardState> {
  const currencyName = CURRENCY_OPTIONS.includes(program.pointCurrencyName)
    ? program.pointCurrencyName
    : 'Other (custom)…'
  const currencyCustom = currencyName === 'Other (custom)…' ? program.pointCurrencyName : ''

  const tiers = program.tiers ?? []

  return {
    programType: (program.type as ProgramType) ?? null,
    name: program.name,
    description: program.description ?? '',
    startDate: program.startDate ? program.startDate.split('T')[0] : '',
    endDate: program.endDate ? program.endDate.split('T')[0] : '',
    currencyName,
    currencyCustom,
    totalBudget: program.budgetUsdCents != null
      ? String(program.budgetUsdCents / 100)
      : '',
    earningRules: (program.earningRules ?? []).map(mapEarningRule),
    tiers: tiers.map(mapTier),
    rewards: (program.rewards ?? []).map((reward) => mapReward(reward, tiers)),
  }
}
