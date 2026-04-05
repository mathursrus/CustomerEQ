import { describe, it, expect } from 'vitest'
import { computeInsights } from './computeInsights.js'

const BASE_INPUTS = {
  atRiskCount: 0,
  activeSurveys: 0,
  responseRate: 50,
  surveyCompletersMultiplier: null,
  surveyCompletersMemberCount: 0,
}

describe('computeInsights()', () => {
  describe('detractors-no-redemption rule', () => {
    it('fires when atRiskCount >= 5', () => {
      const insights = computeInsights({ ...BASE_INPUTS, atRiskCount: 5 })
      expect(insights).toHaveLength(1)
      expect(insights[0].id).toBe('detractors-no-redemption')
      expect(insights[0].severity).toBe('warning')
    })

    it('includes the count in the message', () => {
      const insights = computeInsights({ ...BASE_INPUTS, atRiskCount: 18 })
      expect(insights[0].message).toContain('18')
    })

    it('includes correct CTA href', () => {
      const insights = computeInsights({ ...BASE_INPUTS, atRiskCount: 10 })
      expect(insights[0].ctaHref).toBe('/admin/campaigns/new?filter=detractors&maxNps=6')
    })

    it('does NOT fire when atRiskCount < 5', () => {
      const insights = computeInsights({ ...BASE_INPUTS, atRiskCount: 4 })
      expect(insights.find((i) => i.id === 'detractors-no-redemption')).toBeUndefined()
    })

    it('does NOT fire when atRiskCount is 0', () => {
      const insights = computeInsights({ ...BASE_INPUTS, atRiskCount: 0 })
      expect(insights).toHaveLength(0)
    })
  })

  describe('survey-completers-earn-more rule', () => {
    it('fires when multiplier >= 1.5 and memberCount >= 10', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        surveyCompletersMultiplier: 2.1,
        surveyCompletersMemberCount: 10,
      })
      expect(insights).toHaveLength(1)
      expect(insights[0].id).toBe('survey-completers-earn-more')
      expect(insights[0].severity).toBe('info')
    })

    it('includes multiplier in message formatted to 1 decimal', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        surveyCompletersMultiplier: 2.1,
        surveyCompletersMemberCount: 15,
      })
      expect(insights[0].message).toContain('2.1×')
    })

    it('does NOT fire when multiplier < 1.5', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        surveyCompletersMultiplier: 1.4,
        surveyCompletersMemberCount: 20,
      })
      expect(insights.find((i) => i.id === 'survey-completers-earn-more')).toBeUndefined()
    })

    it('does NOT fire when memberCount < 10 (insufficient data)', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        surveyCompletersMultiplier: 2.5,
        surveyCompletersMemberCount: 9,
      })
      expect(insights.find((i) => i.id === 'survey-completers-earn-more')).toBeUndefined()
    })

    it('does NOT fire when multiplier is null', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        surveyCompletersMultiplier: null,
        surveyCompletersMemberCount: 20,
      })
      expect(insights.find((i) => i.id === 'survey-completers-earn-more')).toBeUndefined()
    })
  })

  describe('low-response-rate rule', () => {
    it('fires when responseRate < 20 and activeSurveys > 0', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        responseRate: 15,
        activeSurveys: 2,
      })
      expect(insights).toHaveLength(1)
      expect(insights[0].id).toBe('low-response-rate')
      expect(insights[0].severity).toBe('warning')
    })

    it('includes rate in message', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        responseRate: 12.7,
        activeSurveys: 1,
      })
      expect(insights[0].message).toContain('13%')
    })

    it('does NOT fire when responseRate >= 20', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        responseRate: 20,
        activeSurveys: 1,
      })
      expect(insights.find((i) => i.id === 'low-response-rate')).toBeUndefined()
    })

    it('does NOT fire when activeSurveys is 0 even with low rate', () => {
      const insights = computeInsights({
        ...BASE_INPUTS,
        responseRate: 5,
        activeSurveys: 0,
      })
      expect(insights.find((i) => i.id === 'low-response-rate')).toBeUndefined()
    })
  })

  describe('max insights cap', () => {
    it('returns at most 3 insights even when all rules qualify', () => {
      const insights = computeInsights({
        atRiskCount: 10,
        activeSurveys: 2,
        responseRate: 5,
        surveyCompletersMultiplier: 2.0,
        surveyCompletersMemberCount: 20,
      })
      expect(insights.length).toBeLessThanOrEqual(3)
    })

    it('rules fire in priority order: detractors-no-redemption first', () => {
      const insights = computeInsights({
        atRiskCount: 10,
        activeSurveys: 2,
        responseRate: 5,
        surveyCompletersMultiplier: 2.0,
        surveyCompletersMemberCount: 20,
      })
      expect(insights[0].id).toBe('detractors-no-redemption')
    })
  })

  describe('empty state', () => {
    it('returns empty array when no rules qualify', () => {
      const insights = computeInsights(BASE_INPUTS)
      expect(insights).toHaveLength(0)
    })
  })
})
