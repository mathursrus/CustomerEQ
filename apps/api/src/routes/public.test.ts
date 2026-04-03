/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { generateWidgetJs, PublicSurveyResponseSchema, SurveyTriggerSchema } from './public.js'

// ---------------------------------------------------------------------------
// PublicSurveyResponseSchema validation
// ---------------------------------------------------------------------------

describe('PublicSurveyResponseSchema', () => {
  const valid = {
    memberEmail: 'user@example.com',
    answers: { q1: 'Great product!' },
    score: 9,
    channel: 'email' as const,
  }

  it('accepts a valid full payload', () => {
    expect(PublicSurveyResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts payload without optional score', () => {
    const { score: _, ...noScore } = valid
    expect(PublicSurveyResponseSchema.safeParse(noScore).success).toBe(true)
  })

  it('defaults channel to "link" when omitted', () => {
    const { channel: _, ...noChannel } = valid
    const result = PublicSurveyResponseSchema.safeParse(noChannel)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.channel).toBe('link')
  })

  it('rejects invalid email', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, memberEmail: 'not-email' }).success).toBe(false)
  })

  it('rejects empty answers', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, answers: {} }).success).toBe(false)
  })

  it('rejects score above 10', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, score: 11 }).success).toBe(false)
  })

  it('rejects score below 0', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, score: -1 }).success).toBe(false)
  })

  it('rejects invalid channel', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, channel: 'carrier_pigeon' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SurveyTriggerSchema validation
// ---------------------------------------------------------------------------

describe('SurveyTriggerSchema', () => {
  it('accepts valid trigger payload', () => {
    const result = SurveyTriggerSchema.safeParse({
      memberEmail: 'test@example.com',
      surveyId: 'survey-123',
      source: 'zendesk',
    })
    expect(result.success).toBe(true)
  })

  it('accepts without optional source', () => {
    const result = SurveyTriggerSchema.safeParse({
      memberEmail: 'test@example.com',
      surveyId: 'survey-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing surveyId', () => {
    const result = SurveyTriggerSchema.safeParse({
      memberEmail: 'test@example.com',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty surveyId', () => {
    const result = SurveyTriggerSchema.safeParse({
      memberEmail: 'test@example.com',
      surveyId: '',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateWidgetJs
// ---------------------------------------------------------------------------

describe('generateWidgetJs', () => {
  const survey = {
    id: 'survey-001',
    name: 'Customer NPS',
    type: 'NPS',
    questions: [{ id: 'q1', text: 'How likely to recommend?', type: 'rating', required: true }],
    incentivePoints: 50,
    brand: { name: 'TestBrand' },
  }

  it('returns a self-invoking function', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toMatch(/^\(function\(\) \{/)
    expect(js).toMatch(/\}\)\(\);$/)
  })

  it('includes the survey id in the container element id', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toContain(`ceq-survey-widget-${survey.id}`)
  })

  it('includes the API URL for form submission', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toContain('https://api.example.com/v1/public/surveys/survey-001/respond')
  })

  it('escapes < and > to prevent XSS via </script> injection', () => {
    const malicious = {
      ...survey,
      name: '<script>alert("xss")</script>',
    }
    const js = generateWidgetJs(malicious, 'https://api.example.com')
    expect(js).not.toContain('<script>')
    expect(js).toContain('\\u003c')
    expect(js).toContain('\\u003e')
  })

  it('includes incentive points badge when survey has incentivePoints', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).toContain('incentivePoints')
  })

  it('handles null incentivePoints', () => {
    const noIncentive = { ...survey, incentivePoints: null }
    const js = generateWidgetJs(noIncentive, 'https://api.example.com')
    expect(js).toContain('incentivePoints')
  })
})
