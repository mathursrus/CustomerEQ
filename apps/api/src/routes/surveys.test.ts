/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateSurveySchema,
  SubmitSurveyResponseSchema,
  UpdateSurveyStatusSchema,
} from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// These tests validate survey schemas and the extractOpenEndedText logic
// without needing a database connection. Integration tests (with real DB)
// live in apps/api/test/integration/.
// ---------------------------------------------------------------------------

describe('Survey schema validation', () => {
  describe('CreateSurveySchema', () => {
    const validPayload = {
      name: 'Customer NPS Survey',
      programId: 'prog-123',
      type: 'NPS' as const,
      questions: [
        { id: 'q1', text: 'How likely are you to recommend us?', type: 'rating', required: true },
      ],
    }

    it('accepts valid NPS survey', () => {
      const result = CreateSurveySchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('accepts survey with incentive points', () => {
      const result = CreateSurveySchema.safeParse({
        ...validPayload,
        incentivePoints: 100,
      })
      expect(result.success).toBe(true)
    })

    it('rejects survey without name', () => {
      const result = CreateSurveySchema.safeParse({
        ...validPayload,
        name: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects survey with empty questions array', () => {
      const result = CreateSurveySchema.safeParse({
        ...validPayload,
        questions: [],
      })
      expect(result.success).toBe(false)
    })

    it('accepts all survey types', () => {
      for (const type of ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const) {
        const result = CreateSurveySchema.safeParse({ ...validPayload, type })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('SubmitSurveyResponseSchema', () => {
    it('accepts valid response with score and channel', () => {
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
        answers: { q1: 5 },
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

    it('rejects invalid channel', () => {
      const result = SubmitSurveyResponseSchema.safeParse({
        memberId: 'member-123',
        answers: { q1: 5 },
        channel: 'carrier_pigeon',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateSurveyStatusSchema', () => {
    it('accepts ACTIVE, PAUSED, CLOSED', () => {
      for (const status of ['ACTIVE', 'PAUSED', 'CLOSED']) {
        expect(UpdateSurveyStatusSchema.safeParse({ status }).success).toBe(true)
      }
    })

    it('rejects DRAFT (cannot go back)', () => {
      expect(UpdateSurveyStatusSchema.safeParse({ status: 'DRAFT' }).success).toBe(false)
    })
  })
})
