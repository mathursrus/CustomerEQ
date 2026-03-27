/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  UpdateAlertRuleStatusSchema,
  UpdateCaseStatusSchema,
  AddCaseNoteSchema,
} from './alert.schema.js'

describe('CreateAlertRuleSchema', () => {
  const validRule = {
    name: 'NPS Detractor Alert',
    defaultAssignee: 'cx-lead@acme.com',
  }

  it('accepts minimal rule with just name and assignee', () => {
    const result = CreateAlertRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
  })

  it('applies defaults for optional fields', () => {
    const result = CreateAlertRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.surveyTypes).toEqual([])
      expect(result.data.scoreMin).toBeNull()
      expect(result.data.scoreMax).toBeNull()
      expect(result.data.sentimentThreshold).toBeNull()
      expect(result.data.topicFilters).toEqual([])
      expect(result.data.slackWebhookUrl).toBeNull()
      expect(result.data.emailRecipients).toEqual([])
      expect(result.data.teamsWebhookUrl).toBeNull()
      expect(result.data.assignmentRules).toEqual([])
      expect(result.data.slaHours).toBeNull()
    }
  })

  it('accepts full rule with all fields', () => {
    const result = CreateAlertRuleSchema.safeParse({
      name: 'Full Alert Rule',
      surveyTypes: ['NPS', 'CSAT'],
      scoreMin: 0,
      scoreMax: 6,
      sentimentThreshold: -0.3,
      topicFilters: ['shipping', 'billing'],
      slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
      slackChannelName: '#cx-alerts',
      emailRecipients: ['team@acme.com', 'lead@acme.com'],
      teamsWebhookUrl: 'https://outlook.office.com/webhook/xxx',
      defaultAssignee: 'Sarah K.',
      assignmentRules: [
        { topic: 'shipping', assignee: 'ops@acme.com' },
        { topic: 'billing', assignee: 'finance@acme.com' },
      ],
      slaHours: 4,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateAlertRuleSchema.safeParse({ ...validRule, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty assignee', () => {
    const result = CreateAlertRuleSchema.safeParse({ ...validRule, defaultAssignee: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email in recipients', () => {
    const result = CreateAlertRuleSchema.safeParse({
      ...validRule,
      emailRecipients: ['not-an-email'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid Slack webhook URL', () => {
    const result = CreateAlertRuleSchema.safeParse({
      ...validRule,
      slackWebhookUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects score out of range', () => {
    expect(CreateAlertRuleSchema.safeParse({ ...validRule, scoreMin: -1 }).success).toBe(false)
    expect(CreateAlertRuleSchema.safeParse({ ...validRule, scoreMax: 11 }).success).toBe(false)
  })

  it('rejects sentiment threshold out of range', () => {
    expect(CreateAlertRuleSchema.safeParse({ ...validRule, sentimentThreshold: -2 }).success).toBe(false)
    expect(CreateAlertRuleSchema.safeParse({ ...validRule, sentimentThreshold: 2 }).success).toBe(false)
  })

  it('rejects invalid survey type', () => {
    const result = CreateAlertRuleSchema.safeParse({ ...validRule, surveyTypes: ['INVALID'] })
    expect(result.success).toBe(false)
  })

  it('rejects negative SLA hours', () => {
    const result = CreateAlertRuleSchema.safeParse({ ...validRule, slaHours: -1 })
    expect(result.success).toBe(false)
  })
})

describe('UpdateAlertRuleSchema', () => {
  it('accepts partial update with name only', () => {
    const result = UpdateAlertRuleSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no changes)', () => {
    const result = UpdateAlertRuleSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('UpdateAlertRuleStatusSchema', () => {
  it('accepts ACTIVE', () => {
    expect(UpdateAlertRuleStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
  })

  it('accepts PAUSED', () => {
    expect(UpdateAlertRuleStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true)
  })

  it('rejects invalid status', () => {
    expect(UpdateAlertRuleStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false)
  })
})

describe('UpdateCaseStatusSchema', () => {
  it('accepts CONTACTED', () => {
    expect(UpdateCaseStatusSchema.safeParse({ status: 'CONTACTED' }).success).toBe(true)
  })

  it('accepts RESOLVED', () => {
    expect(UpdateCaseStatusSchema.safeParse({ status: 'RESOLVED' }).success).toBe(true)
  })

  it('accepts CLOSED', () => {
    expect(UpdateCaseStatusSchema.safeParse({ status: 'CLOSED' }).success).toBe(true)
  })

  it('rejects OPEN (cannot go back to open)', () => {
    expect(UpdateCaseStatusSchema.safeParse({ status: 'OPEN' }).success).toBe(false)
  })
})

describe('AddCaseNoteSchema', () => {
  it('accepts valid note', () => {
    const result = AddCaseNoteSchema.safeParse({ text: 'Called customer, waiting for callback', author: 'Sarah K.' })
    expect(result.success).toBe(true)
  })

  it('rejects empty text', () => {
    expect(AddCaseNoteSchema.safeParse({ text: '', author: 'Sarah K.' }).success).toBe(false)
  })

  it('rejects empty author', () => {
    expect(AddCaseNoteSchema.safeParse({ text: 'Note', author: '' }).success).toBe(false)
  })
})
