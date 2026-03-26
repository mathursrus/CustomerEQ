/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { evaluateTriggerCondition } from './events.js'

describe('evaluateTriggerCondition — string/number coercion', () => {
  // -------------------------------------------------------------------------
  // The API stores trigger condition values from form inputs as strings
  // (e.g., "6" instead of 6). The coercion logic must handle this.
  // -------------------------------------------------------------------------

  it('lte: coerces string condition value "6" when comparing with numeric field 4', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'lte', value: '6' }, { score: 4 }),
    ).toBe(true)
  })

  it('lte: string "6" returns true for field value 6 (equal case)', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'lte', value: '6' }, { score: 6 }),
    ).toBe(true)
  })

  it('lte: string "6" returns false for field value 7', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'lte', value: '6' }, { score: 7 }),
    ).toBe(false)
  })

  it('lt: coerces string "100" correctly against numeric field 50', () => {
    expect(
      evaluateTriggerCondition({ field: 'amount', op: 'lt', value: '100' }, { amount: 50 }),
    ).toBe(true)
  })

  it('gt: coerces string "100" correctly against numeric field 150', () => {
    expect(
      evaluateTriggerCondition({ field: 'amount', op: 'gt', value: '100' }, { amount: 150 }),
    ).toBe(true)
  })

  it('gte: coerces string "10" correctly against numeric field 10', () => {
    expect(
      evaluateTriggerCondition({ field: 'count', op: 'gte', value: '10' }, { count: 10 }),
    ).toBe(true)
  })

  it('eq: coerces string "5" to match numeric field 5', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'eq', value: '5' }, { score: 5 }),
    ).toBe(true)
  })

  it('ne: coerces string "5" — returns true when field is 6', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'ne', value: '5' }, { score: 6 }),
    ).toBe(true)
  })

  // Non-numeric strings should NOT be coerced
  it('eq: preserves non-numeric string comparison', () => {
    expect(
      evaluateTriggerCondition({ field: 'status', op: 'eq', value: 'open' }, { status: 'open' }),
    ).toBe(true)
  })

  it('lte: returns false when condition value is non-numeric string', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'lte', value: 'high' }, { score: 4 }),
    ).toBe(false)
  })

  // Numeric values (not strings) still work
  it('lte: works correctly with numeric condition value (no coercion needed)', () => {
    expect(
      evaluateTriggerCondition({ field: 'score', op: 'lte', value: 6 }, { score: 4 }),
    ).toBe(true)
  })

  // Missing field
  it('returns false when the payload field does not exist', () => {
    expect(
      evaluateTriggerCondition({ field: 'missing', op: 'lte', value: '6' }, { score: 4 }),
    ).toBe(false)
  })
})
