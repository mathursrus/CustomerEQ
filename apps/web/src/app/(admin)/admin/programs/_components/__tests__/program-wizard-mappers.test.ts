import { describe, it, expect } from 'vitest'
import {
  mapReward,
  mapProgramToState,
  type ApiProgram,
  type ApiReward,
  type ApiTier,
} from '../program-wizard-mappers'

// ── Test fixtures ────────────────────────────────────────────────────────────

const silver: ApiTier = {
  id: 'tier-silver',
  name: 'Silver',
  icon: '🥈',
  minPoints: 0,
  minSpendCents: null,
  multiplier: 1,
  benefits: ['Early access'],
}

const gold: ApiTier = {
  id: 'tier-gold',
  name: 'Gold',
  icon: '🥇',
  minPoints: 1000,
  minSpendCents: null,
  multiplier: 1.5,
  benefits: ['Free shipping'],
}

const platinum: ApiTier = {
  id: 'tier-platinum',
  name: 'Platinum',
  icon: '💎',
  minPoints: 5000,
  minSpendCents: null,
  multiplier: 2,
  benefits: ['Concierge support'],
}

function makeReward(overrides: Partial<ApiReward> = {}): ApiReward {
  return {
    id: 'reward-1',
    name: 'Test Reward',
    description: null,
    type: 'Discount Code',
    pointsCost: 200,
    stock: null,
    availableFrom: null,
    availableTo: null,
    eligibleTierIds: [],
    ...overrides,
  }
}

// ── mapReward: eligibleTierIds → eligibleTiers display string ────────────────

describe('mapReward → eligibleTiers resolution (#134)', () => {
  it('renders "All Tiers" when eligibleTierIds is empty', () => {
    const reward = mapReward(makeReward({ eligibleTierIds: [] }), [silver, gold, platinum])
    expect(reward.eligibleTiers).toBe('All Tiers')
  })

  it('renders "All Tiers" when eligibleTierIds is empty and no tiers are defined', () => {
    const reward = mapReward(makeReward({ eligibleTierIds: [] }), [])
    expect(reward.eligibleTiers).toBe('All Tiers')
  })

  it('resolves a single tier id to the matching tier name', () => {
    const reward = mapReward(
      makeReward({ eligibleTierIds: ['tier-platinum'] }),
      [silver, gold, platinum],
    )
    expect(reward.eligibleTiers).toBe('Platinum')
  })

  it('resolves multiple tier ids to a comma-separated list of names', () => {
    const reward = mapReward(
      makeReward({ eligibleTierIds: ['tier-gold', 'tier-platinum'] }),
      [silver, gold, platinum],
    )
    expect(reward.eligibleTiers).toBe('Gold, Platinum')
  })

  it('filters unknown tier ids and falls back to "All Tiers" when none resolve', () => {
    const reward = mapReward(
      makeReward({ eligibleTierIds: ['tier-ghost'] }),
      [silver, gold, platinum],
    )
    expect(reward.eligibleTiers).toBe('All Tiers')
  })

  it('filters unknown tier ids but keeps the known ones', () => {
    const reward = mapReward(
      makeReward({ eligibleTierIds: ['tier-ghost', 'tier-gold'] }),
      [silver, gold, platinum],
    )
    expect(reward.eligibleTiers).toBe('Gold')
  })

  it('preserves tier order as supplied in eligibleTierIds (not program tier order)', () => {
    const reward = mapReward(
      makeReward({ eligibleTierIds: ['tier-platinum', 'tier-silver'] }),
      [silver, gold, platinum],
    )
    expect(reward.eligibleTiers).toBe('Platinum, Silver')
  })
})

// ── mapProgramToState: end-to-end wiring ─────────────────────────────────────

describe('mapProgramToState wires tiers into rewards (#134)', () => {
  const baseProgram: ApiProgram = {
    id: 'prog-1',
    name: 'Diamond Loyalty Club',
    description: null,
    type: 'TIERED',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    pointCurrencyName: 'Points',
    budgetUsdCents: null,
    earningRules: [],
    tiers: [silver, gold, platinum],
    rewards: [
      makeReward({ id: 'r-all', eligibleTierIds: [] }),
      makeReward({ id: 'r-plat', eligibleTierIds: ['tier-platinum'] }),
      makeReward({ id: 'r-gold-plat', eligibleTierIds: ['tier-gold', 'tier-platinum'] }),
    ],
  }

  it('passes the program tiers through so every reward resolves its eligibleTiers correctly', () => {
    const state = mapProgramToState(baseProgram)
    expect(state.rewards).toBeDefined()
    const rewards = state.rewards ?? []
    expect(rewards).toHaveLength(3)
    expect(rewards[0]?.eligibleTiers).toBe('All Tiers')
    expect(rewards[1]?.eligibleTiers).toBe('Platinum')
    expect(rewards[2]?.eligibleTiers).toBe('Gold, Platinum')
  })

  it('still populates all non-reward fields (regression guard)', () => {
    const state = mapProgramToState(baseProgram)
    expect(state.programType).toBe('TIERED')
    expect(state.name).toBe('Diamond Loyalty Club')
    expect(state.currencyName).toBe('Points')
    expect(state.tiers).toHaveLength(3)
    expect(state.tiers?.[0]?.name).toBe('Silver')
  })
})
