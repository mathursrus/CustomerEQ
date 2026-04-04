/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { evaluateConditions, type ConditionGroup } from './conditions.js'

describe('evaluateConditions', () => {
  it('returns true for null conditions', () => {
    expect(evaluateConditions(null, { a: 1 })).toBe(true)
  })

  it('returns true for empty conditions array', () => {
    expect(evaluateConditions({ operator: 'AND', conditions: [] }, { a: 1 })).toBe(true)
  })

  describe('eq operator', () => {
    it('matches equal string values', () => {
      const cond: ConditionGroup = { operator: 'AND', conditions: [{ field: 'status', op: 'eq', value: 'active' }] }
      expect(evaluateConditions(cond, { status: 'active' })).toBe(true)
    })
    it('fails on mismatch', () => {
      const cond: ConditionGroup = { operator: 'AND', conditions: [{ field: 'status', op: 'eq', value: 'active' }] }
      expect(evaluateConditions(cond, { status: 'inactive' })).toBe(false)
    })
  })

  describe('contains operator', () => {
    it('matches when string contains value (case-insensitive)', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'topic', op: 'contains', value: 'refund' }],
      }
      expect(evaluateConditions(cond, { topic: 'Refund Request' })).toBe(true)
    })

    it('is case-insensitive', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', op: 'contains', value: 'HELLO' }],
      }
      expect(evaluateConditions(cond, { name: 'say hello world' })).toBe(true)
    })

    it('fails when string does not contain value', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'topic', op: 'contains', value: 'shipping' }],
      }
      expect(evaluateConditions(cond, { topic: 'billing issue' })).toBe(false)
    })

    it('fails when field is not a string', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'count', op: 'contains', value: 'test' }],
      }
      expect(evaluateConditions(cond, { count: 42 })).toBe(false)
    })

    it('fails when value is not a string', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', op: 'contains', value: 42 }],
      }
      expect(evaluateConditions(cond, { name: 'test 42' })).toBe(false)
    })

    it('fails when field is undefined', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'missing', op: 'contains', value: 'test' }],
      }
      expect(evaluateConditions(cond, { other: 'value' })).toBe(false)
    })
  })

  describe('AND/OR logic', () => {
    it('AND requires all conditions to match', () => {
      const cond: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'a', op: 'eq', value: 1 },
          { field: 'b', op: 'eq', value: 2 },
        ],
      }
      expect(evaluateConditions(cond, { a: 1, b: 2 })).toBe(true)
      expect(evaluateConditions(cond, { a: 1, b: 3 })).toBe(false)
    })

    it('OR requires at least one condition to match', () => {
      const cond: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { field: 'a', op: 'eq', value: 1 },
          { field: 'b', op: 'eq', value: 2 },
        ],
      }
      expect(evaluateConditions(cond, { a: 1, b: 3 })).toBe(true)
      expect(evaluateConditions(cond, { a: 5, b: 3 })).toBe(false)
    })
  })

  describe('numeric operators', () => {
    it('gt works correctly', () => {
      const cond: ConditionGroup = { operator: 'AND', conditions: [{ field: 'score', op: 'gt', value: 5 }] }
      expect(evaluateConditions(cond, { score: 6 })).toBe(true)
      expect(evaluateConditions(cond, { score: 5 })).toBe(false)
    })

    it('lte works correctly', () => {
      const cond: ConditionGroup = { operator: 'AND', conditions: [{ field: 'score', op: 'lte', value: 5 }] }
      expect(evaluateConditions(cond, { score: 5 })).toBe(true)
      expect(evaluateConditions(cond, { score: 6 })).toBe(false)
    })
  })
})
