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
  /**
   * Optimistic-concurrency token. If supplied, the server compares against
   * `Conversation.updatedAt`. A mismatch (a different agent updated the row
   * since the caller fetched it) returns 409 STALE. UIs are expected to read
   * `updatedAt` from the conversation GET and pass it back here.
   *
   * Accepted as ISO-8601 string OR epoch milliseconds; the server normalizes.
   * Optional for backwards compatibility — calls that omit it skip the check
   * (existing automated paths like resolveConversation don't need it).
   */
  expectedUpdatedAt: z.union([z.string().datetime(), z.number().int()]).optional(),
})

// --- Message ---
export const MessageRoleEnum = z.enum(['CUSTOMER', 'AI', 'AGENT'])

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
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
  actionMode: SupportActionModeSchema.optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
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
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

// Public conversation creation — accepts either Bearer email OR anonymous (X-Brand-Id + anonId)
export const StartConversationPublicSchema = z.object({
  initialMessage: z.string().min(1).max(5000),
  anonId: z.string().min(8).max(128).optional(),
  email: z.string().email().optional(),
  /**
   * Explicit consent acknowledgement (ticked the widget's consent checkbox).
   * Required when Brand.consentMode = 'EXPLICIT' AND the body captures `email`.
   * For IMPLIED_ON_SUBMIT brands or anonymous (no-email) submissions, this is
   * not required — the server treats acting on the widget as implicit consent.
   */
  consent: z.boolean().optional(),
})
export type StartConversationPublicInput = z.infer<typeof StartConversationPublicSchema>

// Inferred types
export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type CreateSupportRule = z.infer<typeof CreateSupportRuleSchema>
export type UpdateSupportRule = z.infer<typeof UpdateSupportRuleSchema>
