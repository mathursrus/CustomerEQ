/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateConversationSchema,
  SendMessageSchema,
  CreateSupportRuleSchema,
  UpdateSupportRuleSchema,
  ConversationStatusEnum,
  MessageRoleEnum,
  UpdateConversationStatusSchema,
} from './support.schema.js'

describe('ConversationStatusEnum', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED']) {
      expect(ConversationStatusEnum.safeParse(s).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(ConversationStatusEnum.safeParse('INVALID').success).toBe(false)
  })
})

describe('MessageRoleEnum', () => {
  it('accepts CUSTOMER, AI, AGENT', () => {
    for (const r of ['CUSTOMER', 'AI', 'AGENT']) {
      expect(MessageRoleEnum.safeParse(r).success).toBe(true)
    }
  })
})

describe('CreateConversationSchema', () => {
  it('accepts valid conversation creation', () => {
    const result = CreateConversationSchema.safeParse({
      memberEmail: 'member@example.com',
      initialMessage: 'I was charged twice for my order',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const result = CreateConversationSchema.safeParse({
      initialMessage: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = CreateConversationSchema.safeParse({
      memberEmail: 'not-an-email',
      initialMessage: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty message', () => {
    const result = CreateConversationSchema.safeParse({
      memberEmail: 'member@example.com',
      initialMessage: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects message over 5000 chars', () => {
    const result = CreateConversationSchema.safeParse({
      memberEmail: 'member@example.com',
      initialMessage: 'x'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('SendMessageSchema', () => {
  it('accepts valid message', () => {
    const result = SendMessageSchema.safeParse({ content: 'Hello' })
    expect(result.success).toBe(true)
  })

  it('rejects empty content', () => {
    const result = SendMessageSchema.safeParse({ content: '' })
    expect(result.success).toBe(false)
  })
})

describe('UpdateConversationStatusSchema', () => {
  it('accepts valid status update', () => {
    const result = UpdateConversationStatusSchema.safeParse({ status: 'ESCALATED' })
    expect(result.success).toBe(true)
  })

  it('accepts status with assignee', () => {
    const result = UpdateConversationStatusSchema.safeParse({
      status: 'ESCALATED',
      assignee: 'agent@acme.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = UpdateConversationStatusSchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })
})

describe('CreateSupportRuleSchema', () => {
  const validRule = {
    name: 'Billing Escalation',
  }

  it('accepts minimal rule with just name', () => {
    const result = CreateSupportRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
  })

  it('applies defaults for optional fields', () => {
    const result = CreateSupportRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(0)
      expect(result.data.intentFilters).toEqual([])
      expect(result.data.tierFilters).toEqual([])
      expect(result.data.topicFilters).toEqual([])
      expect(result.data.conditions).toEqual({ operator: 'AND', conditions: [] })
    }
  })

  it('accepts full rule with all fields', () => {
    const result = CreateSupportRuleSchema.safeParse({
      name: 'Gold Billing Escalation',
      description: 'Escalate billing issues for Gold members',
      priority: 1,
      intentFilters: ['billing'],
      tierFilters: ['Gold', 'Platinum'],
      healthScoreMin: 0,
      healthScoreMax: 40,
      topicFilters: ['refund', 'overcharge'],
      conditions: { operator: 'AND', conditions: [] },
      autoRespondArticleId: 'kb-123',
      escalateToAssignee: 'agent@acme.com',
      awardPoints: 500,
      triggerSurveyId: 'survey-456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateSupportRuleSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    const result = CreateSupportRuleSchema.safeParse({ name: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects negative priority', () => {
    const result = CreateSupportRuleSchema.safeParse({ ...validRule, priority: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects healthScoreMin > healthScoreMax', () => {
    const result = CreateSupportRuleSchema.safeParse({
      ...validRule,
      healthScoreMin: 80,
      healthScoreMax: 40,
    })
    expect(result.success).toBe(false)
  })

  it('accepts healthScoreMin equal to healthScoreMax', () => {
    const result = CreateSupportRuleSchema.safeParse({
      ...validRule,
      healthScoreMin: 50,
      healthScoreMax: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid escalateToAssignee (not email)', () => {
    const result = CreateSupportRuleSchema.safeParse({
      ...validRule,
      escalateToAssignee: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative awardPoints', () => {
    const result = CreateSupportRuleSchema.safeParse({
      ...validRule,
      awardPoints: -100,
    })
    expect(result.success).toBe(false)
  })

  it('accepts conditions with contains operator', () => {
    const result = CreateSupportRuleSchema.safeParse({
      ...validRule,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'topic', op: 'contains', value: 'refund' }],
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateSupportRuleSchema', () => {
  it('accepts partial update (just name)', () => {
    const result = UpdateSupportRuleSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts status toggle', () => {
    const result = UpdateSupportRuleSchema.safeParse({ status: 'PAUSED' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = UpdateSupportRuleSchema.safeParse({ status: 'DELETED' })
    expect(result.success).toBe(false)
  })

  it('accepts empty update (all optional)', () => {
    const result = UpdateSupportRuleSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
