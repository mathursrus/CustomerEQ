/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateProgramSchema, UpdateProgramSchema } from './program.schema'

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
