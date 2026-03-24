/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Type definitions that mirror the implementation contract.
// The real implementation will export `evaluateRules` from loyaltyEvents.ts.
// ---------------------------------------------------------------------------

type EarningRule = {
  id: string
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
  maxUsesPerMember: number | null
  status: 'ACTIVE' | 'INACTIVE'
}

/**
 * Pure function under test.
 *
 * The real implementation lives in `./loyaltyEvents`.  We redeclare the
 * signature here so TypeScript can compile this file before the implementation
 * exists; the actual function will be imported once available.
 */
function evaluateRules(
  eventType: string,
  payload: Record<string, unknown>,
  rules: EarningRule[],
  memberRuleUsage: Record<string, number>,
): number {
  // Placeholder body — this file will fail at runtime until the real
  // implementation is provided.  The tests drive the expected contract.
  throw new Error('evaluateRules is not yet implemented')
}

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<EarningRule> & { id: string }): EarningRule {
  return {
    triggerEvent: 'purchase',
    pointsAwarded: 100,
    multiplier: 1.0,
    maxUsesPerMember: null,
    status: 'ACTIVE',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateRules', () => {
  describe('when a single rule matches the event type', () => {
    it('returns the configured pointsAwarded for a matching active rule', () => {
      const rules = [makeRule({ id: 'rule-1', triggerEvent: 'purchase', pointsAwarded: 200 })]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(200)
    })

    it('returns points of 50 when rule is configured with 50 points', () => {
      const rules = [makeRule({ id: 'rule-2', triggerEvent: 'login', pointsAwarded: 50 })]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('login', {}, rules, memberRuleUsage)

      expect(points).toBe(50)
    })
  })

  describe('when a rule has a multiplier', () => {
    it('doubles the pointsAwarded when the multiplier is 2.0', () => {
      const rules = [
        makeRule({ id: 'rule-3', triggerEvent: 'purchase', pointsAwarded: 100, multiplier: 2.0 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(200)
    })

    it('applies a fractional multiplier correctly (1.5x)', () => {
      const rules = [
        makeRule({ id: 'rule-4', triggerEvent: 'review', pointsAwarded: 100, multiplier: 1.5 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('review', {}, rules, memberRuleUsage)

      expect(points).toBe(150)
    })

    it('applies a multiplier of 0.5 to halve the points', () => {
      const rules = [
        makeRule({ id: 'rule-5', triggerEvent: 'share', pointsAwarded: 80, multiplier: 0.5 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('share', {}, rules, memberRuleUsage)

      expect(points).toBe(40)
    })
  })

  describe('when no rules match the event type', () => {
    it('returns 0 points when no rules match the event type', () => {
      const rules = [makeRule({ id: 'rule-6', triggerEvent: 'purchase', pointsAwarded: 100 })]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('checkout_abandoned', {}, rules, memberRuleUsage)

      expect(points).toBe(0)
    })

    it('returns 0 points when the rules array is empty', () => {
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, [], memberRuleUsage)

      expect(points).toBe(0)
    })

    it('returns 0 points when the event type is an empty string', () => {
      const rules = [makeRule({ id: 'rule-7', triggerEvent: 'purchase', pointsAwarded: 100 })]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('', {}, rules, memberRuleUsage)

      expect(points).toBe(0)
    })
  })

  describe('when a rule is INACTIVE', () => {
    it('skips INACTIVE rules and returns 0 even when event type matches', () => {
      const rules = [
        makeRule({ id: 'rule-8', triggerEvent: 'purchase', pointsAwarded: 500, status: 'INACTIVE' }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(0)
    })

    it('applies only ACTIVE rules when a mix of ACTIVE and INACTIVE rules match', () => {
      const rules = [
        makeRule({ id: 'rule-9', triggerEvent: 'purchase', pointsAwarded: 100, status: 'ACTIVE' }),
        makeRule({ id: 'rule-10', triggerEvent: 'purchase', pointsAwarded: 500, status: 'INACTIVE' }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(100)
    })
  })

  describe('when maxUsesPerMember is set', () => {
    it('skips the rule when member has already used it the maximum number of times', () => {
      const rules = [
        makeRule({ id: 'rule-11', triggerEvent: 'purchase', pointsAwarded: 100, maxUsesPerMember: 1 }),
      ]
      const memberRuleUsage: Record<string, number> = { 'rule-11': 1 }

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(0)
    })

    it('applies the rule when member usage count is below the maximum', () => {
      const rules = [
        makeRule({ id: 'rule-12', triggerEvent: 'purchase', pointsAwarded: 100, maxUsesPerMember: 3 }),
      ]
      const memberRuleUsage: Record<string, number> = { 'rule-12': 2 }

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(100)
    })

    it('applies the rule when member has never used it (usage count is 0)', () => {
      const rules = [
        makeRule({ id: 'rule-13', triggerEvent: 'login', pointsAwarded: 25, maxUsesPerMember: 5 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('login', {}, rules, memberRuleUsage)

      expect(points).toBe(25)
    })

    it('applies the rule when maxUsesPerMember is null (unlimited)', () => {
      const rules = [
        makeRule({ id: 'rule-14', triggerEvent: 'review', pointsAwarded: 75, maxUsesPerMember: null }),
      ]
      const memberRuleUsage: Record<string, number> = { 'rule-14': 999 }

      const points = evaluateRules('review', {}, rules, memberRuleUsage)

      expect(points).toBe(75)
    })

    it('skips only the exhausted rule when multiple rules match and one is exhausted', () => {
      const rules = [
        makeRule({ id: 'rule-15', triggerEvent: 'purchase', pointsAwarded: 100, maxUsesPerMember: 1 }),
        makeRule({ id: 'rule-16', triggerEvent: 'purchase', pointsAwarded: 50, maxUsesPerMember: null }),
      ]
      const memberRuleUsage: Record<string, number> = { 'rule-15': 1 }

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(50)
    })
  })

  describe('when multiple rules match the event type', () => {
    it('sums points from all matching active rules', () => {
      const rules = [
        makeRule({ id: 'rule-17', triggerEvent: 'purchase', pointsAwarded: 100 }),
        makeRule({ id: 'rule-18', triggerEvent: 'purchase', pointsAwarded: 50 }),
        makeRule({ id: 'rule-19', triggerEvent: 'purchase', pointsAwarded: 25 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(175)
    })

    it('sums points applying multipliers across all matching rules', () => {
      const rules = [
        makeRule({ id: 'rule-20', triggerEvent: 'purchase', pointsAwarded: 100, multiplier: 2.0 }),
        makeRule({ id: 'rule-21', triggerEvent: 'purchase', pointsAwarded: 50, multiplier: 1.0 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(250)
    })

    it('only counts rules whose triggerEvent matches the given eventType', () => {
      const rules = [
        makeRule({ id: 'rule-22', triggerEvent: 'purchase', pointsAwarded: 100 }),
        makeRule({ id: 'rule-23', triggerEvent: 'login', pointsAwarded: 10 }),
      ]
      const memberRuleUsage: Record<string, number> = {}

      const points = evaluateRules('purchase', {}, rules, memberRuleUsage)

      expect(points).toBe(100)
    })
  })
})
