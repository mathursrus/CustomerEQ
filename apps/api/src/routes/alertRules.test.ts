/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateAlertRuleSchema, UpdateAlertRuleStatusSchema, UpdateCaseStatusSchema, AddCaseNoteSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Alert rule and case schema validation
// ---------------------------------------------------------------------------

describe('Alert rule schema validation', () => {
  describe('CreateAlertRuleSchema', () => {
    const valid = {
      name: 'Low NPS Alert',
      defaultAssignee: 'support@example.com',
    }

    it('accepts a minimal valid alert rule payload', () => {
      expect(CreateAlertRuleSchema.safeParse(valid).success).toBe(true)
    })

    it('accepts full payload with all optional fields', () => {
      const full = {
        ...valid,
        surveyTypes: ['NPS', 'CSAT'] as const,
        scoreMin: 0,
        scoreMax: 6,
        sentimentThreshold: -0.5,
        topicFilters: ['shipping', 'support'],
        slackWebhookUrl: 'https://hooks.slack.com/test',
        emailRecipients: ['admin@example.com', 'ops@example.com'],
        teamsWebhookUrl: 'https://teams.webhook.test',
        slaHours: 24,
        assignmentRules: [{ topic: 'shipping', assignee: 'logistics@example.com' }],
      }
      expect(CreateAlertRuleSchema.safeParse(full).success).toBe(true)
    })

    it('rejects missing name', () => {
      const { name: _, ...noName } = valid
      expect(CreateAlertRuleSchema.safeParse(noName).success).toBe(false)
    })

    it('rejects missing defaultAssignee', () => {
      const { defaultAssignee: _, ...noAssignee } = valid
      expect(CreateAlertRuleSchema.safeParse(noAssignee).success).toBe(false)
    })

    it('rejects scoreMin below 0', () => {
      expect(CreateAlertRuleSchema.safeParse({ ...valid, scoreMin: -1 }).success).toBe(false)
    })

    it('rejects scoreMax above 10', () => {
      expect(CreateAlertRuleSchema.safeParse({ ...valid, scoreMax: 11 }).success).toBe(false)
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
})

describe('Case schema validation', () => {
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

    it('rejects OPEN (cannot go back)', () => {
      expect(UpdateCaseStatusSchema.safeParse({ status: 'OPEN' }).success).toBe(false)
    })
  })

  describe('AddCaseNoteSchema', () => {
    it('accepts valid note', () => {
      expect(AddCaseNoteSchema.safeParse({ text: 'Called the customer', author: 'John' }).success).toBe(true)
    })

    it('rejects empty text', () => {
      expect(AddCaseNoteSchema.safeParse({ text: '', author: 'John' }).success).toBe(false)
    })

    it('rejects missing author', () => {
      expect(AddCaseNoteSchema.safeParse({ text: 'Note text' }).success).toBe(false)
    })
  })
})
