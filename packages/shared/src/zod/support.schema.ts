import { z } from 'zod'

// --- Conversation ---
export const ConversationStatusEnum = z.enum([
  'ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED',
])

export const CreateConversationSchema = z.object({
  memberEmail: z.string().email(),
  initialMessage: z.string().min(1).max(5000),
})

export const UpdateConversationStatusSchema = z.object({
  status: ConversationStatusEnum,
  assignee: z.string().email().optional(),
})

// --- Message ---
export const MessageRoleEnum = z.enum(['CUSTOMER', 'AI', 'AGENT'])

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
})

// --- SupportRule ---
const CreateSupportRuleBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(0).default(0),
  intentFilters: z.array(z.string()).default([]),
  tierFilters: z.array(z.string()).default([]),
  healthScoreMin: z.number().min(0).max(100).optional(),
  healthScoreMax: z.number().min(0).max(100).optional(),
  topicFilters: z.array(z.string()).default([]),
  conditions: z.object({
    operator: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(z.object({
      field: z.string(),
      op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains']),
      value: z.union([z.string(), z.number()]),
    })).default([]),
  }).default({ operator: 'AND', conditions: [] }),
  autoRespondArticleId: z.string().optional(),
  escalateToAssignee: z.string().email().optional(),
  awardPoints: z.number().int().min(0).optional(),
  triggerSurveyId: z.string().optional(),
})

export const CreateSupportRuleSchema = CreateSupportRuleBaseSchema.refine(
  (d) => d.healthScoreMin === undefined || d.healthScoreMax === undefined || d.healthScoreMin <= d.healthScoreMax,
  { message: 'healthScoreMin must be <= healthScoreMax' },
)

export const UpdateSupportRuleSchema = CreateSupportRuleBaseSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
})

// --- Support Orchestration & Action Modes ---
export const SupportActionModeSchema = z.enum(['AUTO_REPLY', 'DRAFT_FOR_AGENT', 'ESCALATE'])
export type SupportActionMode = z.infer<typeof SupportActionModeSchema>

export const ResolutionSourceSchema = z.enum(['CSAT', 'AI_TIMEOUT', 'AGENT'])
export type ResolutionSource = z.infer<typeof ResolutionSourceSchema>

export const ConversationChannelSchema = z.enum(['WIDGET', 'SLACK'])
export type ConversationChannel = z.infer<typeof ConversationChannelSchema>

export const SupportOrchestrationPayloadSchema = z.object({
  conversationId: z.string(),
  brandId: z.string(),
  memberId: z.string().nullable(),
  messageId: z.string(),
  messageContent: z.string(),
})
export type SupportOrchestrationPayload = z.infer<typeof SupportOrchestrationPayloadSchema>

// Inferred types
export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type CreateSupportRule = z.infer<typeof CreateSupportRuleSchema>
export type UpdateSupportRule = z.infer<typeof UpdateSupportRuleSchema>
