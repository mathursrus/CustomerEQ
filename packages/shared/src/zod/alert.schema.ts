import { z } from 'zod'

// ─── Alert Rule ──────────────────────────────────────────────────────────────

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(200),

  // Trigger conditions
  surveyTypes: z.array(z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM'])).default([]),
  scoreMin: z.number().min(0).max(10).nullable().default(null),
  scoreMax: z.number().min(0).max(10).nullable().default(null),
  sentimentThreshold: z.number().min(-1).max(1).nullable().default(null),
  topicFilters: z.array(z.string()).default([]),

  // Alert channels
  slackWebhookUrl: z.string().url().nullable().default(null),
  slackChannelName: z.string().max(100).nullable().default(null),
  emailRecipients: z.array(z.string().email()).default([]),
  teamsWebhookUrl: z.string().url().nullable().default(null),

  // Assignment
  defaultAssignee: z.string().min(1, 'Default assignee is required').max(200),
  assignmentRules: z.array(z.object({
    topic: z.string(),
    assignee: z.string(),
  })).default([]),

  // SLA
  slaHours: z.number().positive().nullable().default(null),
})

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial()

export const UpdateAlertRuleStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED']),
})

// ─── Case Follow-Up ──────────────────────────────────────────────────────────

export const UpdateCaseStatusSchema = z.object({
  status: z.enum(['CONTACTED', 'RESOLVED', 'CLOSED']),
})

export const AddCaseNoteSchema = z.object({
  text: z.string().min(1, 'Note text is required').max(2000),
  author: z.string().min(1).max(200),
})

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleSchema>
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleSchema>
export type UpdateCaseStatusInput = z.infer<typeof UpdateCaseStatusSchema>
export type AddCaseNoteInput = z.infer<typeof AddCaseNoteSchema>
