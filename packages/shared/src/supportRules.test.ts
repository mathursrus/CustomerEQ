/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { evaluateSupportRules, type SupportRuleInput, type SupportRuleContext } from './supportRules.js'

function makeRule(overrides: Partial<SupportRuleInput> = {}): SupportRuleInput {
  return {
    id: overrides.id ?? 'rule-1',
    intentFilters: overrides.intentFilters ?? [],
    tierFilters: overrides.tierFilters ?? [],
    healthScoreMin: overrides.healthScoreMin ?? null,
    healthScoreMax: overrides.healthScoreMax ?? null,
    topicFilters: overrides.topicFilters ?? [],
    conditions: overrides.conditions ?? {},
    autoRespondArticleId: overrides.autoRespondArticleId ?? null,
    escalateToAssignee: overrides.escalateToAssignee ?? null,
    awardPoints: overrides.awardPoints ?? null,
    triggerSurveyId: overrides.triggerSurveyId ?? null,
  }
}

const defaultContext: SupportRuleContext = {
  intent: 'billing',
  tier: 'Gold',
  healthScore: 65,
  topics: ['refund', 'overcharge'],
}

describe('evaluateSupportRules', () => {
  it('returns empty when no rules provided', () => {
    const result = evaluateSupportRules([], defaultContext)
    expect(result.rules).toEqual([])
    expect(result.ruleIds).toEqual([])
    expect(result.shouldEscalate).toBe(false)
    expect(result.escalateToAssignee).toBeNull()
    expect(result.autoResponseContent).toBeNull()
  })

  it('matches a rule with empty filters (catch-all)', () => {
    const rules = [makeRule({ id: 'catch-all' })]
    const result = evaluateSupportRules(rules, defaultContext)
    expect(result.ruleIds).toEqual(['catch-all'])
  })

  describe('intent filtering', () => {
    it('matches when intent is in intentFilters', () => {
      const rules = [makeRule({ id: 'billing-rule', intentFilters: ['billing', 'shipping'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['billing-rule'])
    })

    it('skips when intent is not in intentFilters', () => {
      const rules = [makeRule({ id: 'shipping-only', intentFilters: ['shipping'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual([])
    })

    it('matches all intents when intentFilters is empty', () => {
      const rules = [makeRule({ id: 'all-intents', intentFilters: [] })]
      const result = evaluateSupportRules(rules, { ...defaultContext, intent: 'anything' })
      expect(result.ruleIds).toEqual(['all-intents'])
    })
  })

  describe('tier filtering', () => {
    it('matches when tier is in tierFilters', () => {
      const rules = [makeRule({ id: 'gold-rule', tierFilters: ['Gold', 'Platinum'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['gold-rule'])
    })

    it('skips when tier is not in tierFilters', () => {
      const rules = [makeRule({ id: 'plat-only', tierFilters: ['Platinum'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual([])
    })

    it('skips when tier filters are set but no tier in context', () => {
      const rules = [makeRule({ id: 'tier-rule', tierFilters: ['Gold'] })]
      const result = evaluateSupportRules(rules, { ...defaultContext, tier: undefined })
      expect(result.ruleIds).toEqual([])
    })

    it('matches all tiers when tierFilters is empty', () => {
      const rules = [makeRule({ id: 'all-tiers', tierFilters: [] })]
      const result = evaluateSupportRules(rules, { ...defaultContext, tier: 'Bronze' })
      expect(result.ruleIds).toEqual(['all-tiers'])
    })
  })

  describe('health score filtering', () => {
    it('matches when health score is within range', () => {
      const rules = [makeRule({ id: 'hs-rule', healthScoreMin: 50, healthScoreMax: 80 })]
      const result = evaluateSupportRules(rules, { ...defaultContext, healthScore: 65 })
      expect(result.ruleIds).toEqual(['hs-rule'])
    })

    it('skips when health score is below min', () => {
      const rules = [makeRule({ id: 'hs-rule', healthScoreMin: 70, healthScoreMax: 100 })]
      const result = evaluateSupportRules(rules, { ...defaultContext, healthScore: 65 })
      expect(result.ruleIds).toEqual([])
    })

    it('skips when health score is above max', () => {
      const rules = [makeRule({ id: 'hs-rule', healthScoreMin: 0, healthScoreMax: 50 })]
      const result = evaluateSupportRules(rules, { ...defaultContext, healthScore: 65 })
      expect(result.ruleIds).toEqual([])
    })

    it('matches when only min is set and score is above', () => {
      const rules = [makeRule({ id: 'hs-min', healthScoreMin: 50 })]
      const result = evaluateSupportRules(rules, { ...defaultContext, healthScore: 65 })
      expect(result.ruleIds).toEqual(['hs-min'])
    })

    it('skips when health score filter set but no health score in context', () => {
      const rules = [makeRule({ id: 'hs-rule', healthScoreMin: 50 })]
      const result = evaluateSupportRules(rules, { ...defaultContext, healthScore: undefined })
      expect(result.ruleIds).toEqual([])
    })
  })

  describe('topic filtering', () => {
    it('matches when topic is in topicFilters (case-insensitive)', () => {
      const rules = [makeRule({ id: 'refund-rule', topicFilters: ['Refund'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['refund-rule'])
    })

    it('matches partial topic (contains)', () => {
      const rules = [makeRule({ id: 'charge-rule', topicFilters: ['charge'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['charge-rule'])
    })

    it('skips when no topics match', () => {
      const rules = [makeRule({ id: 'shipping-rule', topicFilters: ['shipping'] })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual([])
    })
  })

  describe('multiple rules (all matching rules fire)', () => {
    it('returns all matching rules', () => {
      const rules = [
        makeRule({ id: 'rule-1', intentFilters: ['billing'] }),
        makeRule({ id: 'rule-2', tierFilters: ['Gold'] }),
        makeRule({ id: 'rule-3', intentFilters: ['shipping'] }),
      ]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['rule-1', 'rule-2'])
    })

    it('preserves priority order (input order)', () => {
      const rules = [
        makeRule({ id: 'low-priority' }),
        makeRule({ id: 'high-priority' }),
      ]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['low-priority', 'high-priority'])
    })
  })

  describe('action properties', () => {
    it('sets shouldEscalate when a matched rule has escalateToAssignee', () => {
      const rules = [makeRule({ id: 'esc-rule', escalateToAssignee: 'agent@acme.com' })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.shouldEscalate).toBe(true)
      expect(result.escalateToAssignee).toBe('agent@acme.com')
    })

    it('sets autoResponseContent when a matched rule has autoRespondArticleId', () => {
      const rules = [makeRule({ id: 'auto-rule', autoRespondArticleId: 'kb-article-123' })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.autoResponseContent).toBe('kb-article-123')
    })

    it('returns first escalation assignee when multiple rules escalate', () => {
      const rules = [
        makeRule({ id: 'rule-1', escalateToAssignee: 'first@acme.com' }),
        makeRule({ id: 'rule-2', escalateToAssignee: 'second@acme.com' }),
      ]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.escalateToAssignee).toBe('first@acme.com')
    })
  })

  describe('combined conditions', () => {
    it('matches rule requiring billing intent AND Gold tier', () => {
      const rules = [makeRule({
        id: 'combined',
        intentFilters: ['billing'],
        tierFilters: ['Gold'],
      })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['combined'])
    })

    it('skips rule when intent matches but tier does not', () => {
      const rules = [makeRule({
        id: 'combined',
        intentFilters: ['billing'],
        tierFilters: ['Platinum'],
      })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual([])
    })

    it('evaluates ConditionGroup conditions', () => {
      const rules = [makeRule({
        id: 'condition-rule',
        conditions: {
          operator: 'AND',
          conditions: [{ field: 'intent', op: 'eq', value: 'billing' }],
        },
      })]
      const result = evaluateSupportRules(rules, defaultContext)
      expect(result.ruleIds).toEqual(['condition-rule'])
    })
  })
})
