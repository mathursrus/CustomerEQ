/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateSurveySchema,
  UpdateSurveyStatusSchema,
  SubmitSurveyResponseSchema,
  SurveyQuestionSchema,
} from './survey.schema.js'

describe('SurveyQuestionSchema', () => {
  it('accepts valid rating question', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Rate our service',
      type: 'rating',
      required: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts text question', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q2',
      text: 'What could we improve?',
      type: 'text',
    })
    expect(result.success).toBe(true)
  })

  it('accepts choice question with options', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q3',
      text: 'Select your experience',
      type: 'choice',
      options: ['Great', 'Good', 'Poor'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects question with empty text', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: '',
      type: 'rating',
    })
    expect(result.success).toBe(false)
  })

  it('rejects question with invalid type', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Test',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateSurveySchema', () => {
  const validSurvey = {
    name: 'Customer NPS Survey',
    programId: 'prog-123',
    type: 'NPS' as const,
    questions: [
      { id: 'q1', text: 'How likely are you to recommend us?', type: 'rating', required: true },
    ],
  }

  it('accepts valid NPS survey', () => {
    const result = CreateSurveySchema.safeParse(validSurvey)
    expect(result.success).toBe(true)
  })

  it('accepts survey with incentive points', () => {
    const result = CreateSurveySchema.safeParse({
      ...validSurvey,
      incentivePoints: 100,
    })
    expect(result.success).toBe(true)
  })

  it('rejects survey with empty name', () => {
    const result = CreateSurveySchema.safeParse({ ...validSurvey, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects survey with no questions', () => {
    const result = CreateSurveySchema.safeParse({ ...validSurvey, questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects survey with invalid type', () => {
    const result = CreateSurveySchema.safeParse({ ...validSurvey, type: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid survey types', () => {
    for (const type of ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const) {
      const result = CreateSurveySchema.safeParse({ ...validSurvey, type })
      expect(result.success).toBe(true)
    }
  })

  it('rejects negative incentive points', () => {
    const result = CreateSurveySchema.safeParse({
      ...validSurvey,
      incentivePoints: -50,
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateSurveyStatusSchema', () => {
  it('accepts ACTIVE status', () => {
    expect(UpdateSurveyStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
  })

  it('accepts PAUSED status', () => {
    expect(UpdateSurveyStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true)
  })

  it('accepts CLOSED status', () => {
    expect(UpdateSurveyStatusSchema.safeParse({ status: 'CLOSED' }).success).toBe(true)
  })

  it('rejects DRAFT status (cannot go back to draft)', () => {
    expect(UpdateSurveyStatusSchema.safeParse({ status: 'DRAFT' }).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(UpdateSurveyStatusSchema.safeParse({ status: 'INVALID' }).success).toBe(false)
  })
})

describe('SubmitSurveyResponseSchema', () => {
  it('accepts valid response', () => {
    const result = SubmitSurveyResponseSchema.safeParse({
      memberId: 'member-123',
      answers: { q1: 9, q2: 'Great service!' },
      score: 9,
      channel: 'email',
    })
    expect(result.success).toBe(true)
  })

  it('defaults channel to link', () => {
    const result = SubmitSurveyResponseSchema.safeParse({
      memberId: 'member-123',
      answers: { q1: 9 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.channel).toBe('link')
    }
  })

  it('rejects empty answers', () => {
    const result = SubmitSurveyResponseSchema.safeParse({
      memberId: 'member-123',
      answers: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing memberId', () => {
    const result = SubmitSurveyResponseSchema.safeParse({
      answers: { q1: 5 },
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid channels', () => {
    for (const channel of ['email', 'in_app', 'link', 'sms'] as const) {
      const result = SubmitSurveyResponseSchema.safeParse({
        memberId: 'member-123',
        answers: { q1: 5 },
        channel,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid channel', () => {
    const result = SubmitSurveyResponseSchema.safeParse({
      memberId: 'member-123',
      answers: { q1: 5 },
      channel: 'carrier_pigeon',
    })
    expect(result.success).toBe(false)
  })
})
