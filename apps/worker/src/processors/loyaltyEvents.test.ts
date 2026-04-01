/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { evaluateRules, evaluateConditions, evaluateRulesWithIds } from './loyaltyEvents.js'

type EarningRule = {
  id: string
  triggerEvent: string
  pointsAwarded: number
  multiplier: number
  maxUsesPerMember: number | null
  status: 'ACTIVE' | 'INACTIVE'
}

type ConditionGroup = {
  operator: 'AND' | 'OR'
  conditions: Array<{ field: string; op: string; value: unknown }>
}

type EarningRuleV2 = EarningRule & {
  priority: number
  stackable: boolean
  conditions: ConditionGroup | null
  budgetCapPoints: number | null
  budgetUsedPoints: number
}

type ProgramBudget = {
  budgetUsdCents: number
  budgetSpentCents: number
  pointToCurrencyRatio: number
} | null

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeRuleV2(overrides: Partial<EarningRuleV2> & { id: string }): EarningRuleV2 {
  return {
    triggerEvent: 'purchase',
    pointsAwarded: 100,
    multiplier: 1.0,
    maxUsesPerMember: null,
    status: 'ACTIVE',
    priority: 1,
    stackable: false,
    conditions: null,
    budgetCapPoints: null,
    budgetUsedPoints: 0,
    ...overrides,
  }
}

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

// ---------------------------------------------------------------------------
// evaluateConditions — pure condition evaluation
// ---------------------------------------------------------------------------

describe('evaluateConditions', () => {
  describe('null conditions (always pass)', () => {
    it('returns true when conditions is null', () => {
      expect(evaluateConditions(null, { amount: 100 })).toBe(true)
    })
  })

  describe('AND operator', () => {
    it('returns true when all conditions match', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'amount', op: 'gte', value: 50 },
          { field: 'category', op: 'eq', value: 'electronics' },
        ],
      }

      expect(evaluateConditions(conditions, { amount: 100, category: 'electronics' })).toBe(true)
    })

    it('returns false when one condition does not match', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'amount', op: 'gte', value: 50 },
          { field: 'category', op: 'eq', value: 'electronics' },
        ],
      }

      expect(evaluateConditions(conditions, { amount: 100, category: 'clothing' })).toBe(false)
    })

    it('returns false when all conditions fail', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'amount', op: 'gte', value: 200 },
          { field: 'category', op: 'eq', value: 'electronics' },
        ],
      }

      expect(evaluateConditions(conditions, { amount: 50, category: 'clothing' })).toBe(false)
    })

    it('returns true when the conditions array is empty', () => {
      const conditions: ConditionGroup = { operator: 'AND', conditions: [] }

      expect(evaluateConditions(conditions, {})).toBe(true)
    })
  })

  describe('OR operator', () => {
    it('returns true when at least one condition matches', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { field: 'amount', op: 'gte', value: 200 },
          { field: 'category', op: 'eq', value: 'electronics' },
        ],
      }

      expect(evaluateConditions(conditions, { amount: 50, category: 'electronics' })).toBe(true)
    })

    it('returns false when no conditions match', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { field: 'amount', op: 'gte', value: 200 },
          { field: 'category', op: 'eq', value: 'electronics' },
        ],
      }

      expect(evaluateConditions(conditions, { amount: 50, category: 'clothing' })).toBe(false)
    })
  })

  describe('numeric operators', () => {
    it('gte: returns true when value equals the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'gte', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 100 })).toBe(true)
    })

    it('gte: returns false when value is below the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'gte', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 99 })).toBe(false)
    })

    it('lte: returns true when value equals the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'lte', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 100 })).toBe(true)
    })

    it('lte: returns false when value exceeds the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'lte', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 101 })).toBe(false)
    })

    it('gt: returns false when value equals the threshold (strict greater than)', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'gt', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 100 })).toBe(false)
    })

    it('gt: returns true when value exceeds the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'gt', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 101 })).toBe(true)
    })

    it('lt: returns true when value is below the threshold', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'lt', value: 100 }],
      }

      expect(evaluateConditions(conditions, { amount: 99 })).toBe(true)
    })

    it('ne: returns true when values differ', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'category', op: 'ne', value: 'clothing' }],
      }

      expect(evaluateConditions(conditions, { category: 'electronics' })).toBe(true)
    })

    it('ne: returns false when values are equal', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'category', op: 'ne', value: 'clothing' }],
      }

      expect(evaluateConditions(conditions, { category: 'clothing' })).toBe(false)
    })
  })

  describe('missing payload field', () => {
    it('returns false when the referenced field is absent from the payload', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'amount', op: 'gte', value: 50 }],
      }

      expect(evaluateConditions(conditions, {})).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// evaluateRulesWithIds — priority + stackable + budget caps (M1 rewrite)
// ---------------------------------------------------------------------------

describe('evaluateRulesWithIds (priority + stackable + budgets)', () => {
  describe('priority ordering', () => {
    it('evaluates lower-priority-number rules first', () => {
      const rules = [
        makeRuleV2({ id: 'p2', priority: 2, pointsAwarded: 200 }),
        makeRuleV2({ id: 'p1', priority: 1, pointsAwarded: 100 }),
      ]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(1)
      expect(result[0].ruleId).toBe('p1')
    })

    it('stops after the first non-stackable match regardless of remaining rules', () => {
      const rules = [
        makeRuleV2({ id: 'r1', priority: 1, stackable: false }),
        makeRuleV2({ id: 'r2', priority: 2, stackable: false }),
      ]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(1)
      expect(result[0].ruleId).toBe('r1')
    })

    it('returns empty when no rules match the event type', () => {
      const rules = [makeRuleV2({ id: 'r1', triggerEvent: 'login', priority: 1, stackable: false })]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(0)
    })
  })

  describe('stackable flag', () => {
    it('continues past a stackable rule to fire the next rule', () => {
      const rules = [
        makeRuleV2({ id: 'r1', priority: 1, stackable: true, pointsAwarded: 50 }),
        makeRuleV2({ id: 'r2', priority: 2, stackable: false, pointsAwarded: 100 }),
      ]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result.map((r) => r.ruleId)).toEqual(['r1', 'r2'])
    })

    it('fires all stackable rules then stops at the first non-stackable', () => {
      const rules = [
        makeRuleV2({ id: 'r1', priority: 1, stackable: true, pointsAwarded: 10 }),
        makeRuleV2({ id: 'r2', priority: 2, stackable: true, pointsAwarded: 20 }),
        makeRuleV2({ id: 'r3', priority: 3, stackable: false, pointsAwarded: 100 }),
        makeRuleV2({ id: 'r4', priority: 4, stackable: false, pointsAwarded: 200 }),
      ]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result.map((r) => r.ruleId)).toEqual(['r1', 'r2', 'r3'])
    })
  })

  describe('per-rule budget cap', () => {
    it('skips a rule whose budgetUsedPoints has reached budgetCapPoints', () => {
      const rules = [
        makeRuleV2({ id: 'r1', priority: 1, stackable: true, budgetCapPoints: 500, budgetUsedPoints: 500 }),
        makeRuleV2({ id: 'r2', priority: 2, stackable: false }),
      ]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result.map((r) => r.ruleId)).toEqual(['r2'])
    })

    it('fires a rule when budgetUsedPoints is below budgetCapPoints', () => {
      const rules = [makeRuleV2({ id: 'r1', priority: 1, stackable: false, budgetCapPoints: 1000, budgetUsedPoints: 999 })]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(1)
    })

    it('fires a rule when budgetCapPoints is null (no cap)', () => {
      const rules = [makeRuleV2({ id: 'r1', priority: 1, stackable: false, budgetCapPoints: null, budgetUsedPoints: 99999 })]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(1)
    })
  })

  describe('program-level budget cap', () => {
    it('returns empty results when program budget is fully spent', () => {
      const rules = [makeRuleV2({ id: 'r1', priority: 1, stackable: false, pointsAwarded: 100 })]
      const programBudget: ProgramBudget = { budgetUsdCents: 10000, budgetSpentCents: 10000, pointToCurrencyRatio: 0.01 }

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, programBudget)

      expect(result).toHaveLength(0)
    })

    it('fires rules when program budget is null (unlimited)', () => {
      const rules = [makeRuleV2({ id: 'r1', priority: 1, stackable: false, pointsAwarded: 100 })]

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, null)

      expect(result).toHaveLength(1)
    })

    it('fires rules when program has remaining budget', () => {
      const rules = [makeRuleV2({ id: 'r1', priority: 1, stackable: false, pointsAwarded: 100 })]
      const programBudget: ProgramBudget = { budgetUsdCents: 10000, budgetSpentCents: 5000, pointToCurrencyRatio: 0.01 }

      const result = evaluateRulesWithIds('purchase', {}, rules, {}, programBudget)

      expect(result).toHaveLength(1)
    })
  })

  describe('conditions integration', () => {
    it('skips a rule when its conditions do not match the payload', () => {
      const rules = [
        makeRuleV2({
          id: 'r1',
          priority: 1,
          stackable: false,
          conditions: {
            operator: 'AND',
            conditions: [{ field: 'amount', op: 'gte', value: 200 }],
          },
        }),
      ]

      const result = evaluateRulesWithIds('purchase', { amount: 50 }, rules, {}, null)

      expect(result).toHaveLength(0)
    })

    it('fires a rule when its conditions match the payload', () => {
      const rules = [
        makeRuleV2({
          id: 'r1',
          priority: 1,
          stackable: false,
          conditions: {
            operator: 'AND',
            conditions: [{ field: 'amount', op: 'gte', value: 50 }],
          },
        }),
      ]

      const result = evaluateRulesWithIds('purchase', { amount: 100 }, rules, {}, null)

      expect(result).toHaveLength(1)
      expect(result[0].ruleId).toBe('r1')
    })
  })
})
