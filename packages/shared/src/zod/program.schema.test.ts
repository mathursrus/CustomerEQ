/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateProgramSchema,
  UpdateProgramSchema,
  UpdateProgramStatusSchema,
  SimulateSchema,
} from './program.schema'
import { CreateTierSchema, UpdateTierSchema } from './tier.schema'
import { CreateRewardSchema, RetireRewardSchema } from './reward.schema'

describe('CreateProgramSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid program with all fields provided', () => {
      const input = {
        name: 'Gold Rewards',
        pointCurrencyName: 'Gold Coins',
        pointToCurrencyRatio: 0.01,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a valid program with only the required name field', () => {
      const input = { name: 'Basic Rewards' }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a program with pointCurrencyName and no ratio', () => {
      const input = {
        name: 'Silver Tier',
        pointCurrencyName: 'Silver Stars',
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a program with a very large positive pointToCurrencyRatio', () => {
      const input = {
        name: 'Mega Rewards',
        pointToCurrencyRatio: 9999.99,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a pointToCurrencyRatio of a tiny positive decimal', () => {
      const input = {
        name: 'Micro Rewards',
        pointToCurrencyRatio: 0.0001,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects an empty name string', () => {
      const input = { name: '' }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects when name is missing entirely', () => {
      const input = { pointCurrencyName: 'Points' }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects a negative pointToCurrencyRatio', () => {
      const input = {
        name: 'Bad Ratio Program',
        pointToCurrencyRatio: -1,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointToCurrencyRatio'))).toBe(true)
    })

    it('rejects a zero pointToCurrencyRatio', () => {
      const input = {
        name: 'Zero Ratio Program',
        pointToCurrencyRatio: 0,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointToCurrencyRatio'))).toBe(true)
    })

    it('rejects a string value for pointToCurrencyRatio', () => {
      const input = {
        name: 'Wrong Type Program',
        pointToCurrencyRatio: 'not-a-number',
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointToCurrencyRatio'))).toBe(true)
    })

    it('rejects a numeric value for name', () => {
      const input = { name: 42 }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects a numeric value for pointCurrencyName', () => {
      const input = {
        name: 'Valid Name',
        pointCurrencyName: 99,
      }

      const result = CreateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointCurrencyName'))).toBe(true)
    })
  })
})

describe('UpdateProgramSchema', () => {
  describe('valid inputs', () => {
    it('accepts a partial update with only the name changed', () => {
      const input = { name: 'Renamed Rewards' }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts an update with only pointToCurrencyRatio changed', () => {
      const input = { pointToCurrencyRatio: 0.05 }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts an empty object (no-op update)', () => {
      const input = {}

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a full update with all fields provided', () => {
      const input = {
        name: 'Updated Program',
        pointCurrencyName: 'Diamond Points',
        pointToCurrencyRatio: 0.02,
      }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects an empty name string in an update', () => {
      const input = { name: '' }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects a negative pointToCurrencyRatio in an update', () => {
      const input = { pointToCurrencyRatio: -5 }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointToCurrencyRatio'))).toBe(true)
    })

    it('rejects a zero pointToCurrencyRatio in an update', () => {
      const input = { pointToCurrencyRatio: 0 }

      const result = UpdateProgramSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointToCurrencyRatio'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// CreateProgramSchema — M1 additions (type, dates, budget fields)
// ---------------------------------------------------------------------------

describe('CreateProgramSchema — M1 additions', () => {
  describe('type field', () => {
    it('accepts a valid type of POINTS', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', type: 'POINTS' })

      expect(result.success).toBe(true)
    })

    it('accepts all valid program types', () => {
      for (const type of ['POINTS', 'TIERED', 'CASHBACK', 'HYBRID']) {
        const result = CreateProgramSchema.safeParse({ name: 'P', type })
        expect(result.success).toBe(true)
      }
    })

    it('rejects an unknown type value', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', type: 'UNKNOWN' })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('type'))).toBe(true)
    })

    it('defaults to POINTS when type is omitted', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P' })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.type).toBe('POINTS')
    })
  })

  describe('budget fields', () => {
    it('accepts a positive integer budgetUsdCents', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', budgetUsdCents: 100000 })

      expect(result.success).toBe(true)
    })

    it('rejects a negative budgetUsdCents', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', budgetUsdCents: -1 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('budgetUsdCents'))).toBe(true)
    })

    it('accepts valid haltBehavior values', () => {
      for (const haltBehavior of ['PAUSE_PROGRAM', 'PAUSE_RULES']) {
        const result = CreateProgramSchema.safeParse({ name: 'P', haltBehavior })
        expect(result.success).toBe(true)
      }
    })

    it('rejects an invalid haltBehavior value', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', haltBehavior: 'STOP_ALL' })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('haltBehavior'))).toBe(true)
    })

    it('accepts alertThresholdPct between 0 and 100', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', alertThresholdPct: 80 })

      expect(result.success).toBe(true)
    })

    it('rejects alertThresholdPct above 100', () => {
      const result = CreateProgramSchema.safeParse({ name: 'P', alertThresholdPct: 101 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('alertThresholdPct'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// UpdateProgramStatusSchema
// ---------------------------------------------------------------------------

describe('UpdateProgramStatusSchema', () => {
  it('accepts ACTIVE', () => {
    expect(UpdateProgramStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
  })

  it('accepts PAUSED', () => {
    expect(UpdateProgramStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true)
  })

  it('accepts ARCHIVED', () => {
    expect(UpdateProgramStatusSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(true)
  })

  it('rejects DRAFT (cannot transition back to DRAFT via this endpoint)', () => {
    const result = UpdateProgramStatusSchema.safeParse({ status: 'DRAFT' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('status'))).toBe(true)
  })

  it('rejects a missing status field', () => {
    expect(UpdateProgramStatusSchema.safeParse({}).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SimulateSchema
// ---------------------------------------------------------------------------

describe('SimulateSchema', () => {
  it('accepts a valid eventType with no payload', () => {
    const result = SimulateSchema.safeParse({ eventType: 'purchase' })

    expect(result.success).toBe(true)
  })

  it('accepts eventType plus an arbitrary payload object', () => {
    const result = SimulateSchema.safeParse({ eventType: 'purchase', payload: { amount: 150, category: 'electronics' } })

    expect(result.success).toBe(true)
  })

  it('rejects an empty eventType string', () => {
    const result = SimulateSchema.safeParse({ eventType: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('eventType'))).toBe(true)
  })

  it('rejects when eventType is missing', () => {
    const result = SimulateSchema.safeParse({ payload: { amount: 100 } })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('eventType'))).toBe(true)
  })

  it('defaults payload to an empty object when omitted', () => {
    const result = SimulateSchema.safeParse({ eventType: 'login' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.payload).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// CreateTierSchema
// ---------------------------------------------------------------------------

describe('CreateTierSchema', () => {
  describe('valid inputs', () => {
    it('accepts a minimal tier with name and rank', () => {
      const result = CreateTierSchema.safeParse({ name: 'Bronze', rank: 1 })

      expect(result.success).toBe(true)
    })

    it('accepts a full tier with all fields provided', () => {
      const result = CreateTierSchema.safeParse({
        name: 'Gold',
        rank: 3,
        minPoints: 5000,
        minSpendCents: 100000,
        benefits: ['Free shipping', 'Priority support'],
        multiplier: 2.0,
        icon: '🥇',
      })

      expect(result.success).toBe(true)
    })

    it('defaults benefits to an empty array when omitted', () => {
      const result = CreateTierSchema.safeParse({ name: 'Silver', rank: 2 })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.benefits).toEqual([])
    })

    it('defaults multiplier to 1.0 when omitted', () => {
      const result = CreateTierSchema.safeParse({ name: 'Silver', rank: 2 })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.multiplier).toBe(1.0)
    })
  })

  describe('invalid inputs', () => {
    it('rejects an empty name', () => {
      const result = CreateTierSchema.safeParse({ name: '', rank: 1 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects rank of 0 (must be at least 1)', () => {
      const result = CreateTierSchema.safeParse({ name: 'Bronze', rank: 0 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('rank'))).toBe(true)
    })

    it('rejects a negative multiplier', () => {
      const result = CreateTierSchema.safeParse({ name: 'Bronze', rank: 1, multiplier: -1 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('multiplier'))).toBe(true)
    })

    it('rejects negative minPoints', () => {
      const result = CreateTierSchema.safeParse({ name: 'Bronze', rank: 1, minPoints: -10 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('minPoints'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// UpdateTierSchema
// ---------------------------------------------------------------------------

describe('UpdateTierSchema', () => {
  it('accepts an empty object (no-op)', () => {
    expect(UpdateTierSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a partial update with only the name changed', () => {
    expect(UpdateTierSchema.safeParse({ name: 'Platinum' }).success).toBe(true)
  })

  it('rejects an empty name string in an update', () => {
    const result = UpdateTierSchema.safeParse({ name: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CreateRewardSchema
// ---------------------------------------------------------------------------

describe('CreateRewardSchema', () => {
  describe('valid inputs', () => {
    it('accepts a minimal reward with required fields', () => {
      const result = CreateRewardSchema.safeParse({
        name: 'Free Coffee',
        type: 'FREE_ITEM',
        pointsCost: 500,
      })

      expect(result.success).toBe(true)
    })

    it('accepts all valid reward types', () => {
      for (const type of ['DISCOUNT', 'FREE_ITEM', 'EXPERIENCE', 'VOUCHER']) {
        const result = CreateRewardSchema.safeParse({ name: 'R', type, pointsCost: 100 })
        expect(result.success).toBe(true)
      }
    })

    it('accepts a reward with availableFrom and availableTo ISO date strings', () => {
      const result = CreateRewardSchema.safeParse({
        name: 'Summer Deal',
        type: 'DISCOUNT',
        pointsCost: 200,
        availableFrom: '2026-06-01T00:00:00.000Z',
        availableTo: '2026-08-31T23:59:59.000Z',
      })

      expect(result.success).toBe(true)
    })

    it('accepts eligibleTierIds as an array of strings', () => {
      const result = CreateRewardSchema.safeParse({
        name: 'VIP Reward',
        type: 'EXPERIENCE',
        pointsCost: 1000,
        eligibleTierIds: ['tier-gold-id', 'tier-platinum-id'],
      })

      expect(result.success).toBe(true)
    })

    it('defaults eligibleTierIds to an empty array when omitted', () => {
      const result = CreateRewardSchema.safeParse({ name: 'R', type: 'VOUCHER', pointsCost: 100 })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.eligibleTierIds).toEqual([])
    })
  })

  describe('invalid inputs', () => {
    it('rejects an unknown reward type', () => {
      const result = CreateRewardSchema.safeParse({ name: 'R', type: 'MYSTERY_BOX', pointsCost: 100 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('type'))).toBe(true)
    })

    it('rejects a zero pointsCost', () => {
      const result = CreateRewardSchema.safeParse({ name: 'R', type: 'DISCOUNT', pointsCost: 0 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointsCost'))).toBe(true)
    })

    it('rejects a negative pointsCost', () => {
      const result = CreateRewardSchema.safeParse({ name: 'R', type: 'DISCOUNT', pointsCost: -100 })

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('pointsCost'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// RetireRewardSchema
// ---------------------------------------------------------------------------

describe('RetireRewardSchema', () => {
  it('accepts an empty body (retire immediately)', () => {
    expect(RetireRewardSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a future ISO datetime for expireAt', () => {
    const result = RetireRewardSchema.safeParse({ expireAt: '2027-01-01T00:00:00.000Z' })

    expect(result.success).toBe(true)
  })

  it('rejects a non-datetime string for expireAt', () => {
    const result = RetireRewardSchema.safeParse({ expireAt: 'next-tuesday' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('expireAt'))).toBe(true)
  })
})
