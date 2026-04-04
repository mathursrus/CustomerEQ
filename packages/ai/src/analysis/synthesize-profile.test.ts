/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { buildCustomerContext } from './synthesize-profile.js'
import type { Customer360Response } from '@customerEQ/shared'

function make360Response(overrides?: Partial<Customer360Response>): Customer360Response {
  const base: Customer360Response = {
    member: {
      id: 'mem_1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      phone: '+1234567890',
      pointsBalance: 1500,
      status: 'ACTIVE',
      enrollmentDate: new Date(Date.now() - 90 * 86400000).toISOString(), // 90 days ago
      consentGivenAt: new Date().toISOString(),
      consentVersion: 'v1.0',
      tier: { id: 'tier_1', name: 'Gold', rank: 2, benefits: {}, multiplier: 1.5 },
    },
    recentEvents: {
      items: [
        { id: 'ev_1', eventType: 'purchase', pointsEarned: 100, payload: {}, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
        { id: 'ev_2', eventType: 'survey_complete', pointsEarned: 50, payload: {}, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
      ],
      hasMore: false,
      total: 2,
    },
    surveyResponses: {
      items: [
        { id: 'sr_1', surveyName: 'NPS Q1', surveyType: 'NPS', score: 9, sentiment: 0.8, topics: ['service', 'speed'], summary: null, completedAt: new Date().toISOString() },
        { id: 'sr_2', surveyName: 'CSAT Q4', surveyType: 'CSAT', score: 7, sentiment: 0.3, topics: ['quality'], summary: null, completedAt: new Date().toISOString() },
      ],
      hasMore: false,
      total: 2,
    },
    redemptions: {
      items: [
        { id: 'red_1', rewardName: 'Gift Card', pointsSpent: 500, status: 'FULFILLED', createdAt: new Date().toISOString() },
      ],
      hasMore: false,
      total: 1,
    },
    campaignEvents: {
      items: [],
      hasMore: false,
      total: 0,
    },
    openCases: [
      { id: 'case_1', status: 'OPEN', priority: 'HIGH', assignee: 'agent_1', slaDeadline: null, createdAt: new Date().toISOString() },
    ],
    stats: {
      totalEvents: 2,
      totalSurveyResponses: 2,
      averageSentiment: 0.55,
      totalPointsEarned: 150,
      totalPointsRedeemed: 500,
    },
  }
  return { ...base, ...overrides }
}

describe('buildCustomerContext', () => {
  it('transforms 360 response into CustomerContext correctly', () => {
    const data = make360Response()
    const ctx = buildCustomerContext(data)

    expect(ctx.memberStatus).toBe('ACTIVE')
    expect(ctx.pointsBalance).toBe(1500)
    expect(ctx.tierName).toBe('Gold')
    expect(ctx.totalEvents).toBe(2)
    expect(ctx.totalSurveyResponses).toBe(2)
    expect(ctx.averageSentiment).toBe(0.55)
    expect(ctx.totalPointsEarned).toBe(150)
    expect(ctx.totalPointsRedeemed).toBe(500)
    expect(ctx.recentEventTypes).toEqual(['purchase', 'survey_complete'])
    expect(ctx.recentSentiments).toEqual([0.8, 0.3])
    expect(ctx.recentNpsScores).toEqual([9, 7])
    expect(ctx.recentTopics).toEqual([['service', 'speed'], ['quality']])
    expect(ctx.hasOpenCases).toBe(true)
    expect(ctx.openCaseCount).toBe(1)
    expect(ctx.daysSinceEnrollment).toBeGreaterThanOrEqual(89)
    expect(ctx.daysSinceEnrollment).toBeLessThanOrEqual(91)
    expect(ctx.daysSinceLastEvent).toBeGreaterThanOrEqual(1)
    expect(ctx.daysSinceLastEvent).toBeLessThanOrEqual(3)
  })

  it('output contains no PII fields', () => {
    const data = make360Response()
    const ctx = buildCustomerContext(data)
    const json = JSON.stringify(ctx)

    // Must not contain PII
    expect(json).not.toContain('alice@example.com')
    expect(json).not.toContain('Alice')
    expect(json).not.toContain('Smith')
    expect(json).not.toContain('+1234567890')
  })

  it('handles null tier', () => {
    const data = make360Response({
      member: {
        ...make360Response().member,
        tier: null,
      },
    })
    const ctx = buildCustomerContext(data)
    expect(ctx.tierName).toBeNull()
  })

  it('handles empty sub-collections', () => {
    const data = make360Response({
      recentEvents: { items: [], hasMore: false, total: 0 },
      surveyResponses: { items: [], hasMore: false, total: 0 },
      openCases: [],
    })
    const ctx = buildCustomerContext(data)

    expect(ctx.recentEventTypes).toEqual([])
    expect(ctx.recentSentiments).toEqual([])
    expect(ctx.recentNpsScores).toEqual([])
    expect(ctx.recentTopics).toEqual([])
    expect(ctx.hasOpenCases).toBe(false)
    expect(ctx.openCaseCount).toBe(0)
    expect(ctx.daysSinceLastEvent).toBeNull()
  })

  it('filters out null sentiment and score values', () => {
    const data = make360Response({
      surveyResponses: {
        items: [
          { id: 'sr_1', surveyName: 'S1', surveyType: 'NPS', score: null, sentiment: null, topics: [], summary: null, completedAt: new Date().toISOString() },
          { id: 'sr_2', surveyName: 'S2', surveyType: 'CSAT', score: 8, sentiment: 0.5, topics: ['good'], summary: null, completedAt: new Date().toISOString() },
        ],
        hasMore: false,
        total: 2,
      },
    })
    const ctx = buildCustomerContext(data)

    expect(ctx.recentSentiments).toEqual([0.5])
    expect(ctx.recentNpsScores).toEqual([8])
    // Topics still include both (even null-score entries have topics)
    expect(ctx.recentTopics).toEqual([[], ['good']])
  })
})
