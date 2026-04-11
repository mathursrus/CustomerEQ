/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateSurveySchema,
  UpdateSurveySchema,
  UpdateSurveyStatusSchema,
  SubmitSurveyResponseSchema,
  SurveyQuestionSchema,
  SkipRuleSchema,
  SkipConditionSchema,
  CreateSurveyThemeSchema,
  UpdateSurveyThemeSchema,
  CreateQuestionTemplateSchema,
  QUESTION_TYPES,
  SurveyRuleInputSchema,
  LaunchSurveySchema,
  CreateCxPlaybookSchema,
  UpdateCxPlaybookSchema,
  evaluateSurveyRule,
  validateRuleOverlap,
} from './survey.schema.js'

// ─── SurveyQuestionSchema ───────────────────────────────────────────────────

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

  it('accepts choice question with options (legacy)', () => {
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

  it('accepts all new question types', () => {
    for (const type of QUESTION_TYPES) {
      const result = SurveyQuestionSchema.safeParse({
        id: 'q1',
        text: `Test ${type} question`,
        type,
      })
      expect(result.success, `Expected type "${type}" to be valid`).toBe(true)
    }
  })

  it('accepts question with config', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Rate us',
      type: 'slider',
      config: { min: 1, max: 10, step: 1, labels: { left: 'Bad', right: 'Great' } },
    })
    expect(result.success).toBe(true)
  })

  it('accepts matrix question with rows and columns config', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Rate these aspects',
      type: 'matrix',
      config: {
        rows: ['Product', 'Service', 'Price'],
        columns: ['Poor', 'Fair', 'Good', 'Excellent'],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts question with skip rules', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q2',
      text: 'Follow-up question',
      type: 'text',
      skipRules: [{
        targetQuestionId: 'q2',
        action: 'show',
        conditions: [{ sourceQuestionId: 'q1', operator: 'lt', value: 7 }],
        conditionLogic: 'AND',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts image_choice question with imageOptions config', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Pick a design',
      type: 'image_choice',
      config: {
        imageOptions: [
          { label: 'Option A', imageUrl: 'https://example.com/a.png' },
          { label: 'Option B', imageUrl: 'https://example.com/b.png' },
        ],
        multiSelect: false,
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts file_upload question with constraints config', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'Upload your receipt',
      type: 'file_upload',
      config: { maxSizeMB: 10, allowedTypes: ['image/png', 'image/jpeg', 'application/pdf'] },
    })
    expect(result.success).toBe(true)
  })

  it('accepts likert question with scale config', () => {
    const result = SurveyQuestionSchema.safeParse({
      id: 'q1',
      text: 'I am satisfied with the service',
      type: 'likert',
      config: { scale: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
    })
    expect(result.success).toBe(true)
  })
})

// ─── SkipConditionSchema / SkipRuleSchema ───────────────────────────────────

describe('SkipConditionSchema', () => {
  it('accepts valid condition with numeric value', () => {
    const result = SkipConditionSchema.safeParse({
      sourceQuestionId: 'q1',
      operator: 'lt',
      value: 5,
    })
    expect(result.success).toBe(true)
  })

  it('accepts condition with string value', () => {
    const result = SkipConditionSchema.safeParse({
      sourceQuestionId: 'q1',
      operator: 'eq',
      value: 'yes',
    })
    expect(result.success).toBe(true)
  })

  it('accepts condition with is_empty (no value needed)', () => {
    const result = SkipConditionSchema.safeParse({
      sourceQuestionId: 'q1',
      operator: 'is_empty',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all operator types', () => {
    const operators = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains', 'not_contains', 'is_empty', 'is_not_empty'] as const
    for (const op of operators) {
      const result = SkipConditionSchema.safeParse({
        sourceQuestionId: 'q1',
        operator: op,
      })
      expect(result.success, `Expected operator "${op}" to be valid`).toBe(true)
    }
  })

  it('rejects invalid operator', () => {
    const result = SkipConditionSchema.safeParse({
      sourceQuestionId: 'q1',
      operator: 'between',
      value: 5,
    })
    expect(result.success).toBe(false)
  })
})

describe('SkipRuleSchema', () => {
  it('accepts valid skip rule', () => {
    const result = SkipRuleSchema.safeParse({
      targetQuestionId: 'q3',
      action: 'show',
      conditions: [{ sourceQuestionId: 'q1', operator: 'lte', value: 6 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts hide action', () => {
    const result = SkipRuleSchema.safeParse({
      targetQuestionId: 'q3',
      action: 'hide',
      conditions: [{ sourceQuestionId: 'q1', operator: 'gt', value: 8 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts OR condition logic', () => {
    const result = SkipRuleSchema.safeParse({
      targetQuestionId: 'q3',
      action: 'show',
      conditions: [
        { sourceQuestionId: 'q1', operator: 'lt', value: 3 },
        { sourceQuestionId: 'q2', operator: 'contains', value: 'bad' },
      ],
      conditionLogic: 'OR',
    })
    expect(result.success).toBe(true)
  })

  it('defaults conditionLogic to AND', () => {
    const result = SkipRuleSchema.safeParse({
      targetQuestionId: 'q3',
      action: 'show',
      conditions: [{ sourceQuestionId: 'q1', operator: 'eq', value: 5 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.conditionLogic).toBe('AND')
    }
  })

  it('rejects skip rule with no conditions', () => {
    const result = SkipRuleSchema.safeParse({
      targetQuestionId: 'q3',
      action: 'show',
      conditions: [],
    })
    expect(result.success).toBe(false)
  })
})

// ─── CreateSurveySchema ─────────────────────────────────────────────────────

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

  it('accepts survey with themeId', () => {
    const result = CreateSurveySchema.safeParse({
      ...validSurvey,
      themeId: 'theme-123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts survey with extended question types', () => {
    const result = CreateSurveySchema.safeParse({
      ...validSurvey,
      questions: [
        { id: 'q1', text: 'Rate us', type: 'slider', config: { min: 1, max: 10 } },
        { id: 'q2', text: 'Pick area', type: 'multiple_choice', config: { options: ['A', 'B'] } },
        { id: 'q3', text: 'Rate aspects', type: 'matrix', config: { rows: ['X'], columns: ['Good', 'Bad'] } },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ─── UpdateSurveySchema ─────────────────────────────────────────────────────

describe('UpdateSurveySchema', () => {
  it('accepts partial update with name only', () => {
    const result = UpdateSurveySchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with questions only', () => {
    const result = UpdateSurveySchema.safeParse({
      questions: [{ id: 'q1', text: 'Updated question', type: 'text' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts themeId set to null (remove theme)', () => {
    const result = UpdateSurveySchema.safeParse({ themeId: null })
    expect(result.success).toBe(true)
  })

  it('rejects empty questions array', () => {
    const result = UpdateSurveySchema.safeParse({ questions: [] })
    expect(result.success).toBe(false)
  })
})

// ─── UpdateSurveyStatusSchema ───────────────────────────────────────────────

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

// ─── SubmitSurveyResponseSchema ─────────────────────────────────────────────

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

// ─── CreateSurveyThemeSchema ────────────────────────────────────────────────

describe('CreateSurveyThemeSchema', () => {
  it('accepts minimal theme with just a name', () => {
    const result = CreateSurveyThemeSchema.safeParse({ name: 'Corporate Blue' })
    expect(result.success).toBe(true)
  })

  it('applies default colors', () => {
    const result = CreateSurveyThemeSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryColor).toBe('#6366f1')
      expect(result.data.backgroundColor).toBe('#ffffff')
      expect(result.data.fontFamily).toBe('system-ui')
      expect(result.data.cardStyle).toBe('shadow')
      expect(result.data.showIncentivePoints).toBe(true)
    }
  })

  it('accepts full theme with all fields', () => {
    const result = CreateSurveyThemeSchema.safeParse({
      name: 'Acme Brand',
      isDefault: true,
      logoUrl: 'https://acme.com/logo.png',
      brandName: 'Acme Corp',
      primaryColor: '#1a56db',
      secondaryColor: '#3b82f6',
      backgroundColor: '#f0f5ff',
      textColor: '#1e293b',
      buttonColor: '#1a56db',
      buttonTextColor: '#ffffff',
      accentColor: '#1a56db',
      fontFamily: 'Inter',
      headingSize: 'lg',
      bodySize: 'md',
      cardStyle: 'border',
      borderRadius: 'lg',
      maxWidth: 'lg',
      thankYouMessage: 'Thanks! You earned {{points}} points.',
      thankYouRedirectUrl: 'https://acme.com/thanks',
      showIncentivePoints: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid hex color', () => {
    const result = CreateSurveyThemeSchema.safeParse({
      name: 'Bad Theme',
      primaryColor: 'not-a-color',
    })
    expect(result.success).toBe(false)
  })

  it('rejects HTTP logo URL (requires HTTPS)', () => {
    const result = CreateSurveyThemeSchema.safeParse({
      name: 'Insecure',
      logoUrl: 'http://example.com/logo.png',
    })
    expect(result.success).toBe(false)
  })

  it('accepts 3-digit hex colors', () => {
    const result = CreateSurveyThemeSchema.safeParse({
      name: 'Short Hex',
      primaryColor: '#f00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty theme name', () => {
    const result = CreateSurveyThemeSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ─── UpdateSurveyThemeSchema ────────────────────────────────────────────────

describe('UpdateSurveyThemeSchema', () => {
  it('accepts partial update with single color', () => {
    const result = UpdateSurveyThemeSchema.safeParse({ primaryColor: '#ff0000' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no changes)', () => {
    const result = UpdateSurveyThemeSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('does not accept isDefault (use separate endpoint)', () => {
    const result = UpdateSurveyThemeSchema.safeParse({ isDefault: true })
    // isDefault is omitted from the partial, so it should be stripped
    expect(result.success).toBe(true)
    if (result.success) {
      expect('isDefault' in result.data).toBe(false)
    }
  })
})

// ─── CreateQuestionTemplateSchema ───────────────────────────────────────────

describe('CreateQuestionTemplateSchema', () => {
  it('accepts valid template', () => {
    const result = CreateQuestionTemplateSchema.safeParse({
      name: 'Standard NPS Question',
      question: {
        id: 'q1',
        text: 'How likely are you to recommend us?',
        type: 'rating',
        config: { min: 0, max: 10, labels: { left: 'Not likely', right: 'Very likely' } },
      },
      tags: ['nps', 'standard'],
    })
    expect(result.success).toBe(true)
  })

  it('defaults tags to empty array', () => {
    const result = CreateQuestionTemplateSchema.safeParse({
      name: 'Basic Text',
      question: { id: 'q1', text: 'Any feedback?', type: 'text' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([])
    }
  })

  it('rejects template with empty name', () => {
    const result = CreateQuestionTemplateSchema.safeParse({
      name: '',
      question: { id: 'q1', text: 'Test', type: 'text' },
    })
    expect(result.success).toBe(false)
  })
})

// ─── Issue #80: SurveyRuleInputSchema ────────────────────────────────────────

describe('SurveyRuleInputSchema', () => {
  const validRule = {
    scoreMin: 0,
    scoreMax: 6,
    actionType: 'award_points',
    actionConfig: { points: 100 },
  }

  it('accepts a valid rule', () => {
    expect(SurveyRuleInputSchema.safeParse(validRule).success).toBe(true)
  })

  it('accepts all action types', () => {
    const types = ['award_points', 'award_reward', 'send_message', 'spin_wheel', 'scratch_card', 'mystery_box']
    for (const actionType of types) {
      const result = SurveyRuleInputSchema.safeParse({ ...validRule, actionType })
      expect(result.success, `Expected actionType "${actionType}" to be valid`).toBe(true)
    }
  })

  it('rejects scoreMin > scoreMax', () => {
    const result = SurveyRuleInputSchema.safeParse({ ...validRule, scoreMin: 7, scoreMax: 6 })
    expect(result.success).toBe(false)
  })

  it('accepts scoreMin === scoreMax (single-score rule)', () => {
    const result = SurveyRuleInputSchema.safeParse({ ...validRule, scoreMin: 5, scoreMax: 5 })
    expect(result.success).toBe(true)
  })

  it('accepts boundary values 0 and 10', () => {
    const result = SurveyRuleInputSchema.safeParse({ ...validRule, scoreMin: 0, scoreMax: 10 })
    expect(result.success).toBe(true)
  })

  it('rejects score out of range', () => {
    expect(SurveyRuleInputSchema.safeParse({ ...validRule, scoreMin: -1, scoreMax: 6 }).success).toBe(false)
    expect(SurveyRuleInputSchema.safeParse({ ...validRule, scoreMin: 0, scoreMax: 11 }).success).toBe(false)
  })

  it('accepts optional ruleLabel', () => {
    const result = SurveyRuleInputSchema.safeParse({ ...validRule, ruleLabel: 'Detractors' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid actionType', () => {
    expect(SurveyRuleInputSchema.safeParse({ ...validRule, actionType: 'teleport_points' }).success).toBe(false)
  })
})

// ─── Issue #80: LaunchSurveySchema ───────────────────────────────────────────

describe('LaunchSurveySchema', () => {
  it('accepts empty rules (launch without rules)', () => {
    expect(LaunchSurveySchema.safeParse({ rules: [] }).success).toBe(true)
  })

  it('accepts rules array with one rule', () => {
    const result = LaunchSurveySchema.safeParse({
      rules: [{ scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 } }],
    })
    expect(result.success).toBe(true)
  })
})

// ─── Issue #80: CreateCxPlaybookSchema ───────────────────────────────────────

describe('CreateCxPlaybookSchema', () => {
  it('accepts valid playbook', () => {
    const result = CreateCxPlaybookSchema.safeParse({
      name: 'Detractor Rescue',
      surveyType: 'NPS',
      rules: [{ scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 } }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(CreateCxPlaybookSchema.safeParse({
      name: '',
      surveyType: 'NPS',
      rules: [{ scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: {} }],
    }).success).toBe(false)
  })

  it('rejects empty rules', () => {
    expect(CreateCxPlaybookSchema.safeParse({
      name: 'Test',
      surveyType: 'NPS',
      rules: [],
    }).success).toBe(false)
  })

  it('accepts all survey types', () => {
    for (const surveyType of ['NPS', 'CSAT', 'CES', 'CUSTOM'] as const) {
      const result = CreateCxPlaybookSchema.safeParse({
        name: `${surveyType} Playbook`,
        surveyType,
        rules: [{ scoreMin: 0, scoreMax: 5, actionType: 'award_points', actionConfig: {} }],
      })
      expect(result.success, `Expected surveyType "${surveyType}" to be valid`).toBe(true)
    }
  })
})

describe('UpdateCxPlaybookSchema', () => {
  it('accepts partial update with name only', () => {
    expect(UpdateCxPlaybookSchema.safeParse({ name: 'New Name' }).success).toBe(true)
  })

  it('accepts partial update with rules only', () => {
    expect(UpdateCxPlaybookSchema.safeParse({
      rules: [{ scoreMin: 7, scoreMax: 10, actionType: 'award_points', actionConfig: { points: 50 } }],
    }).success).toBe(true)
  })
})

// ─── Issue #80: evaluateSurveyRule pure function ──────────────────────────────

describe('evaluateSurveyRule', () => {
  const rule = { scoreMin: 0, scoreMax: 6 }

  it('returns true for score within range', () => {
    expect(evaluateSurveyRule(rule, 3)).toBe(true)
  })

  it('returns true for score at lower boundary (scoreMin)', () => {
    expect(evaluateSurveyRule(rule, 0)).toBe(true)
  })

  it('returns true for score at upper boundary (scoreMax)', () => {
    expect(evaluateSurveyRule(rule, 6)).toBe(true)
  })

  it('returns false for score below range', () => {
    expect(evaluateSurveyRule(rule, -1)).toBe(false)
  })

  it('returns false for score above range', () => {
    expect(evaluateSurveyRule(rule, 7)).toBe(false)
  })

  it('handles single-score rule (scoreMin === scoreMax)', () => {
    const singleRule = { scoreMin: 9, scoreMax: 9 }
    expect(evaluateSurveyRule(singleRule, 9)).toBe(true)
    expect(evaluateSurveyRule(singleRule, 8)).toBe(false)
    expect(evaluateSurveyRule(singleRule, 10)).toBe(false)
  })
})

// ─── Issue #80: validateRuleOverlap pure function ────────────────────────────

describe('validateRuleOverlap', () => {
  it('returns no errors for non-overlapping rules', () => {
    const rules = [
      { scoreMin: 0, scoreMax: 6 },
      { scoreMin: 7, scoreMax: 8 },
      { scoreMin: 9, scoreMax: 10 },
    ]
    expect(validateRuleOverlap(rules)).toHaveLength(0)
  })

  it('returns no errors for single rule', () => {
    expect(validateRuleOverlap([{ scoreMin: 0, scoreMax: 6 }])).toHaveLength(0)
  })

  it('returns no errors for empty array', () => {
    expect(validateRuleOverlap([])).toHaveLength(0)
  })

  it('returns error for overlapping rules', () => {
    const rules = [
      { scoreMin: 0, scoreMax: 6 },
      { scoreMin: 5, scoreMax: 8 }, // overlaps with first (5 <= 6 AND 0 <= 8)
    ]
    const errors = validateRuleOverlap(rules)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual({ ruleIndexA: 0, ruleIndexB: 1 })
  })

  it('returns multiple errors when multiple pairs overlap', () => {
    const rules = [
      { scoreMin: 0, scoreMax: 7 },
      { scoreMin: 5, scoreMax: 10 },
      { scoreMin: 3, scoreMax: 6 },
    ]
    const errors = validateRuleOverlap(rules)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('treats exact adjacency as non-overlapping (0–6 and 7–10)', () => {
    const rules = [
      { scoreMin: 0, scoreMax: 6 },
      { scoreMin: 7, scoreMax: 10 },
    ]
    expect(validateRuleOverlap(rules)).toHaveLength(0)
  })

  it('treats single-point overlap as overlapping (0–6 and 6–10)', () => {
    const rules = [
      { scoreMin: 0, scoreMax: 6 },
      { scoreMin: 6, scoreMax: 10 },
    ]
    expect(validateRuleOverlap(rules)).toHaveLength(1)
  })
})
