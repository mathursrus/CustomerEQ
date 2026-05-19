import { describe, it, expect } from 'vitest'
import { evaluateSupportRules } from './supportRules.js'

const baseRule = {
  id: 'r1',
  status: 'ACTIVE' as const,
  priority: 0,
  intentFilters: ['shipping_question'],
  tierFilters: [],
  healthScoreMin: null,
  healthScoreMax: null,
  topicFilters: [],
  conditions: {},
  actionMode: 'AUTO_REPLY' as const,
  confidenceThreshold: 0.8,
  autoRespondArticleId: 'a1',
  escalateToAssignee: null,
  awardPoints: null,
  triggerSurveyId: null,
}

describe('evaluateSupportRules', () => {
  it('returns actionMode + confidenceThreshold for each matched rule', () => {
    const result = evaluateSupportRules([baseRule], {
      intent: 'shipping_question',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules).toHaveLength(1)
    expect(result.matchedRules[0]).toMatchObject({
      ruleId: 'r1',
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.8,
    })
  })

  it('orders matches by priority ascending', () => {
    const r1 = { ...baseRule, id: 'low', priority: 10 }
    const r2 = { ...baseRule, id: 'high', priority: 1 }
    const result = evaluateSupportRules([r1, r2], {
      intent: 'shipping_question',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules.map((m) => m.ruleId)).toEqual(['high', 'low'])
  })

  it('does not match when intent filter excludes', () => {
    const result = evaluateSupportRules([baseRule], {
      intent: 'refund_request',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules).toHaveLength(0)
  })
})
