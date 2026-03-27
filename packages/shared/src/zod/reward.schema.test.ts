/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateRewardSchema, RetireRewardSchema } from './reward.schema.js'

describe('CreateRewardSchema', () => {
  const validFull = {
    name: 'Free Coffee',
    description: 'A complimentary coffee of any size',
    type: 'FREE_ITEM' as const,
    pointsCost: 500,
    stock: 100,
    availableFrom: '2026-01-01T00:00:00Z',
    availableTo: '2026-12-31T23:59:59Z',
    eligibleTierIds: ['tier_gold', 'tier_platinum'],
  }

  it('accepts valid reward with all fields', () => {
    const result = CreateRewardSchema.safeParse(validFull)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Free Coffee')
      expect(result.data.eligibleTierIds).toEqual(['tier_gold', 'tier_platinum'])
    }
  })

  it('accepts valid minimal reward (required fields only)', () => {
    const result = CreateRewardSchema.safeParse({
      name: 'Basic Discount',
      type: 'DISCOUNT',
      pointsCost: 200,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.eligibleTierIds).toEqual([])
      expect(result.data.description).toBeUndefined()
      expect(result.data.stock).toBeUndefined()
    }
  })

  it.each(['DISCOUNT', 'FREE_ITEM', 'EXPERIENCE', 'VOUCHER'] as const)(
    'accepts reward type %s',
    (type) => {
      const result = CreateRewardSchema.safeParse({
        name: 'Test Reward',
        type,
        pointsCost: 100,
      })
      expect(result.success).toBe(true)
    },
  )

  it('rejects empty name', () => {
    const result = CreateRewardSchema.safeParse({
      name: '',
      type: 'DISCOUNT',
      pointsCost: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative pointsCost', () => {
    const result = CreateRewardSchema.safeParse({
      name: 'Bad Reward',
      type: 'DISCOUNT',
      pointsCost: -10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid reward type', () => {
    const result = CreateRewardSchema.safeParse({
      name: 'Bad Type',
      type: 'GIFT_CARD',
      pointsCost: 100,
    })
    expect(result.success).toBe(false)
  })
})

describe('RetireRewardSchema', () => {
  it('accepts valid expireAt datetime', () => {
    const result = RetireRewardSchema.safeParse({
      expireAt: '2026-06-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no expireAt)', () => {
    const result = RetireRewardSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
