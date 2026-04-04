/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { RecomputeHealthScoreSchema, HealthScoreFilterSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Health score endpoint schema validation
// ---------------------------------------------------------------------------

describe('Health score endpoint schemas', () => {
  describe('RecomputeHealthScoreSchema', () => {
    it('accepts an empty body (recompute all members)', () => {
      const result = RecomputeHealthScoreSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.memberId).toBeUndefined()
      }
    })

    it('accepts a specific memberId for single-member recompute', () => {
      const result = RecomputeHealthScoreSchema.safeParse({ memberId: 'member-123' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.memberId).toBe('member-123')
      }
    })

    it('rejects non-string memberId', () => {
      const result = RecomputeHealthScoreSchema.safeParse({ memberId: 42 })
      expect(result.success).toBe(false)
    })
  })

  describe('HealthScoreFilterSchema (used by GET /v1/members)', () => {
    it('parses valid min/max query parameters', () => {
      const result = HealthScoreFilterSchema.safeParse({
        healthScoreMin: '0',
        healthScoreMax: '30',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.healthScoreMin).toBe(0)
        expect(result.data.healthScoreMax).toBe(30)
      }
    })

    it('accepts numeric values directly', () => {
      const result = HealthScoreFilterSchema.safeParse({
        healthScoreMin: 50,
        healthScoreMax: 80,
      })
      expect(result.success).toBe(true)
    })

    it('rejects healthScoreMin above 100', () => {
      const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 150 })
      expect(result.success).toBe(false)
    })

    it('rejects healthScoreMax below 0', () => {
      const result = HealthScoreFilterSchema.safeParse({ healthScoreMax: -5 })
      expect(result.success).toBe(false)
    })

    it('rejects floating point values', () => {
      const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 25.7 })
      expect(result.success).toBe(false)
    })
  })
})
