'use client'

import { ProgramWizard } from './program-wizard'
import type { WizardState, ProgramType, EarningRule, Tier, Reward, Condition } from './program-wizard'

// ── API shapes (from GET /v1/programs/:id) ───────────────────────────────────

interface ApiConditionGroup {
  operator: 'AND' | 'OR'
  conditions: Array<{ field: string; op: string; value: unknown }>
}

interface ApiEarningRule {
  id: string
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
  conditions: ApiConditionGroup | null
  priority: number
  stackable: boolean
  budgetCapPoints: number | null
}

interface ApiTier {
  id: string
  name: string
  icon: string | null
  minPoints: number | null
  minSpendCents: number | null
  multiplier: number
  benefits: string[]
}

interface ApiReward {
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

interface ApiProgram {
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

interface ProgramWizardLoaderProps {
  mode: 'edit' | 'view'
  programId: string
  program: ApiProgram
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

function mapEarningRule(r: ApiEarningRule): EarningRule {
  const conditions: Condition[] = (r.conditions?.conditions ?? []).map((c) => ({
    id: crypto.randomUUID(),
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

function mapTier(t: ApiTier): Tier {
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

function mapReward(r: ApiReward, tiers: ApiTier[]): Reward {
  const hasDateRange = r.availableFrom != null || r.availableTo != null
  const eligibleTiers =
    r.eligibleTierIds.length === 0
      ? 'All Tiers'
      : tiers
          .filter((t) => r.eligibleTierIds.includes(t.id))
          .map((t) => t.name)
          .join(', ') || 'All Tiers'
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

function mapProgramToState(program: ApiProgram): Partial<WizardState> {
  const currencyName = CURRENCY_OPTIONS.includes(program.pointCurrencyName)
    ? program.pointCurrencyName
    : 'Other (custom)…'
  const currencyCustom = currencyName === 'Other (custom)…' ? program.pointCurrencyName : ''

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
    tiers: (program.tiers ?? []).map(mapTier),
    rewards: (program.rewards ?? []).map((r) => mapReward(r, program.tiers ?? [])),
  }
}

export function ProgramWizardLoader({ mode, programId, program }: ProgramWizardLoaderProps) {
  const initialState = mapProgramToState(program)
  return (
    <ProgramWizard
      mode={mode}
      programId={programId}
      initialState={initialState}
    />
  )
}
