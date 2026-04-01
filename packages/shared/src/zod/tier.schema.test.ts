/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateTierSchema, UpdateTierSchema } from './tier.schema.js'

describe('CreateTierSchema', () => {
  const validTier = {
    name: 'Gold',
    rank: 2,
    icon: 'star',
    minPoints: 1000,
    minSpendCents: 50000,
    benefits: ['Free shipping', 'Priority support'],
    multiplier: 1.5,
  }

  it('accepts valid tier with all fields', () => {
    const result = CreateTierSchema.safeParse(validTier)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Gold')
      expect(result.data.rank).toBe(2)
      expect(result.data.benefits).toEqual(['Free shipping', 'Priority support'])
    }
  })

  it('applies defaults for benefits and multiplier', () => {
    const result = CreateTierSchema.safeParse({ name: 'Bronze', rank: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.benefits).toEqual([])
      expect(result.data.multiplier).toBe(1.0)
    }
  })

  it('rejects empty name', () => {
    const result = CreateTierSchema.safeParse({ name: '', rank: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects rank less than 1', () => {
    const result = CreateTierSchema.safeParse({ name: 'Invalid', rank: 0 })
    expect(result.success).toBe(false)
  })
})

describe('UpdateTierSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateTierSchema.safeParse({ name: 'Platinum', multiplier: 2.0 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Platinum')
      expect(result.data.multiplier).toBe(2.0)
    }
  })

  it('accepts empty object', () => {
    const result = UpdateTierSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
