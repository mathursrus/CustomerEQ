/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { matchesRule, resolveAssignee, determinePriority } from './alertEvaluation.js'

// ---------------------------------------------------------------------------
// matchesRule
// ---------------------------------------------------------------------------

describe('matchesRule', () => {
  const baseRule = {
    surveyTypes: [] as string[],
    scoreMin: null as number | null,
    scoreMax: null as number | null,
    sentimentThreshold: null as number | null,
    topicFilters: [] as string[],
  }

  it('matches when all filters are empty (catch-all rule)', () => {
    expect(matchesRule(baseRule, 'NPS', 5, -0.2, ['shipping'])).toBe(true)
  })

  it('matches when survey type is in the allowed list', () => {
    const rule = { ...baseRule, surveyTypes: ['NPS', 'CSAT'] }
    expect(matchesRule(rule, 'NPS', 5, null, [])).toBe(true)
    expect(matchesRule(rule, 'CSAT', 3, null, [])).toBe(true)
  })

  it('does not match when survey type is not in the allowed list', () => {
    const rule = { ...baseRule, surveyTypes: ['NPS'] }
    expect(matchesRule(rule, 'CSAT', 3, null, [])).toBe(false)
  })

  it('matches when score is within range', () => {
    const rule = { ...baseRule, scoreMin: 0, scoreMax: 6 }
    expect(matchesRule(rule, 'NPS', 4, null, [])).toBe(true)
    expect(matchesRule(rule, 'NPS', 0, null, [])).toBe(true)
    expect(matchesRule(rule, 'NPS', 6, null, [])).toBe(true)
  })

  it('does not match when score is outside range', () => {
    const rule = { ...baseRule, scoreMin: 0, scoreMax: 6 }
    expect(matchesRule(rule, 'NPS', 7, null, [])).toBe(false)
    expect(matchesRule(rule, 'NPS', 9, null, [])).toBe(false)
  })

  it('does not match when score filter exists but response has no score', () => {
    const rule = { ...baseRule, scoreMin: 0, scoreMax: 6 }
    expect(matchesRule(rule, 'NPS', null, null, [])).toBe(false)
  })

  it('matches when scoreMin only is set and score is above', () => {
    const rule = { ...baseRule, scoreMin: 3, scoreMax: null }
    expect(matchesRule(rule, 'NPS', 5, null, [])).toBe(true)
    expect(matchesRule(rule, 'NPS', 3, null, [])).toBe(true)
  })

  it('does not match when score is below scoreMin', () => {
    const rule = { ...baseRule, scoreMin: 3, scoreMax: null }
    expect(matchesRule(rule, 'NPS', 2, null, [])).toBe(false)
  })

  it('matches when sentiment is below threshold', () => {
    const rule = { ...baseRule, sentimentThreshold: -0.3 }
    expect(matchesRule(rule, 'NPS', 5, -0.5, [])).toBe(true)
    expect(matchesRule(rule, 'NPS', 5, -0.8, [])).toBe(true)
  })

  it('does not match when sentiment is above threshold', () => {
    const rule = { ...baseRule, sentimentThreshold: -0.3 }
    expect(matchesRule(rule, 'NPS', 5, 0.2, [])).toBe(false)
    expect(matchesRule(rule, 'NPS', 5, -0.1, [])).toBe(false)
  })

  it('does not match sentiment rule when sentiment is null', () => {
    const rule = { ...baseRule, sentimentThreshold: -0.3 }
    expect(matchesRule(rule, 'NPS', 5, null, [])).toBe(false)
  })

  it('matches when response has at least one matching topic', () => {
    const rule = { ...baseRule, topicFilters: ['shipping', 'billing'] }
    expect(matchesRule(rule, 'NPS', 5, null, ['shipping'])).toBe(true)
    expect(matchesRule(rule, 'NPS', 5, null, ['billing', 'product'])).toBe(true)
  })

  it('does not match when response has no matching topics', () => {
    const rule = { ...baseRule, topicFilters: ['shipping', 'billing'] }
    expect(matchesRule(rule, 'NPS', 5, null, ['product', 'support'])).toBe(false)
  })

  it('matches topics case-insensitively', () => {
    const rule = { ...baseRule, topicFilters: ['Shipping'] }
    expect(matchesRule(rule, 'NPS', 5, null, ['shipping'])).toBe(true)
  })

  it('matches with all conditions combined (AND logic)', () => {
    const rule = {
      surveyTypes: ['NPS'],
      scoreMin: 0 as number | null,
      scoreMax: 6 as number | null,
      sentimentThreshold: -0.3 as number | null,
      topicFilters: ['shipping'],
    }
    // All conditions met
    expect(matchesRule(rule, 'NPS', 2, -0.5, ['shipping'])).toBe(true)
    // Survey type doesn't match
    expect(matchesRule(rule, 'CSAT', 2, -0.5, ['shipping'])).toBe(false)
    // Score too high
    expect(matchesRule(rule, 'NPS', 8, -0.5, ['shipping'])).toBe(false)
    // Sentiment too positive
    expect(matchesRule(rule, 'NPS', 2, 0.1, ['shipping'])).toBe(false)
    // Topic doesn't match
    expect(matchesRule(rule, 'NPS', 2, -0.5, ['product'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveAssignee
// ---------------------------------------------------------------------------

describe('resolveAssignee', () => {
  it('returns default assignee when no assignment rules match', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [{ topic: 'billing', assignee: 'finance@acme.com' }],
    }
    expect(resolveAssignee(rule, ['shipping'])).toBe('cx-team@acme.com')
  })

  it('returns topic-specific assignee when topic matches', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [
        { topic: 'shipping', assignee: 'ops@acme.com' },
        { topic: 'billing', assignee: 'finance@acme.com' },
      ],
    }
    expect(resolveAssignee(rule, ['shipping'])).toBe('ops@acme.com')
    expect(resolveAssignee(rule, ['billing'])).toBe('finance@acme.com')
  })

  it('returns first matching assignee when multiple topics match', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [
        { topic: 'shipping', assignee: 'ops@acme.com' },
        { topic: 'billing', assignee: 'finance@acme.com' },
      ],
    }
    expect(resolveAssignee(rule, ['billing', 'shipping'])).toBe('ops@acme.com')
  })

  it('matches topics case-insensitively', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [{ topic: 'Shipping', assignee: 'ops@acme.com' }],
    }
    expect(resolveAssignee(rule, ['shipping'])).toBe('ops@acme.com')
  })

  it('returns default assignee when assignment rules are empty', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [],
    }
    expect(resolveAssignee(rule, ['shipping'])).toBe('cx-team@acme.com')
  })

  it('returns default assignee when topics are empty', () => {
    const rule = {
      defaultAssignee: 'cx-team@acme.com',
      assignmentRules: [{ topic: 'shipping', assignee: 'ops@acme.com' }],
    }
    expect(resolveAssignee(rule, [])).toBe('cx-team@acme.com')
  })
})

// ---------------------------------------------------------------------------
// determinePriority
// ---------------------------------------------------------------------------

describe('determinePriority', () => {
  it('returns CRITICAL for score 0-2', () => {
    expect(determinePriority(0, null)).toBe('CRITICAL')
    expect(determinePriority(1, null)).toBe('CRITICAL')
    expect(determinePriority(2, null)).toBe('CRITICAL')
  })

  it('returns HIGH for score 3-4', () => {
    expect(determinePriority(3, null)).toBe('HIGH')
    expect(determinePriority(4, null)).toBe('HIGH')
  })

  it('returns HIGH for very negative sentiment', () => {
    expect(determinePriority(5, -0.8)).toBe('HIGH')
    expect(determinePriority(null, -0.9)).toBe('HIGH')
  })

  it('returns MEDIUM for score 5-6', () => {
    expect(determinePriority(5, null)).toBe('MEDIUM')
    expect(determinePriority(6, null)).toBe('MEDIUM')
  })

  it('returns LOW for higher scores', () => {
    expect(determinePriority(7, null)).toBe('LOW')
    expect(determinePriority(8, null)).toBe('LOW')
    expect(determinePriority(null, null)).toBe('LOW')
  })

  it('score takes precedence over sentiment for CRITICAL', () => {
    // Score 1 = CRITICAL even if sentiment is positive
    expect(determinePriority(1, 0.5)).toBe('CRITICAL')
  })
})
