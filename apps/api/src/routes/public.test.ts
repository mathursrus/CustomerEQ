/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { generateWidgetJs, PublicSurveyResponseSchema, SurveyTriggerSchema } from './public.js'

// ---------------------------------------------------------------------------
// PublicSurveyResponseSchema validation
// ---------------------------------------------------------------------------

describe('PublicSurveyResponseSchema', () => {
  // Issue #231 PR2 — accepts memberId (new) or memberEmail (legacy back-compat).
  const valid = {
    memberId: 'user@example.com',
    answers: { q1: 'Great product!' },
    score: 9,
    channel: 'email' as const,
  }

  it('accepts a valid payload with memberId', () => {
    expect(PublicSurveyResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts legacy memberEmail field for back-compat with existing widget.js', () => {
    const legacy = {
      memberEmail: 'user@example.com',
      answers: { q1: 'Great product!' },
      score: 9,
    }
    expect(PublicSurveyResponseSchema.safeParse(legacy).success).toBe(true)
  })

  it('accepts payload without optional score', () => {
    const { score: _, ...noScore } = valid
    expect(PublicSurveyResponseSchema.safeParse(noScore).success).toBe(true)
  })

  it('accepts payload without memberId — handler enforces URL-query-or-body identifier', () => {
    // The schema permits both memberId and memberEmail to be absent because
    // the URL-query path (?member_id=…) is also a valid identifier carrier;
    // the route handler enforces "at least one of (query, body)".
    const { memberId: _, ...noId } = valid
    expect(PublicSurveyResponseSchema.safeParse(noId).success).toBe(true)
  })

  it('defaults channel to "link" when omitted', () => {
    const { channel: _, ...noChannel } = valid
    const result = PublicSurveyResponseSchema.safeParse(noChannel)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.channel).toBe('link')
  })

  it('rejects invalid memberEmail when supplied', () => {
    const bad = { memberEmail: 'not-email', answers: { q1: 'x' } }
    expect(PublicSurveyResponseSchema.safeParse(bad).success).toBe(false)
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

  it('accepts optional consent boolean (R16 EXPLICIT-mode opt-in marker)', () => {
    expect(PublicSurveyResponseSchema.safeParse({ ...valid, consent: true }).success).toBe(true)
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

  // Issue #241 — the prior "incentive points badge" tests are removed.
  // `Survey.incentivePoints` is gone (D19/D40/D50); points never appear on
  // the form. The widget no longer renders or references incentive points.
  it('does not render an incentive points badge', () => {
    const js = generateWidgetJs(survey, 'https://api.example.com')
    expect(js).not.toContain('incentivePoints')
  })
})
