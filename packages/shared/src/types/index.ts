export interface InternalCxEvent {
  type: string // e.g. "cx.nps_submitted", "cx.ticket_resolved"
  externalId: string // source system identifier
  memberEmail: string
  payload: Record<string, unknown>
}

export interface LoyaltyEventPayload {
  brandId: string
  memberId: string
  eventType: string
  payload: Record<string, unknown>
  idempotencyKey?: string
  ingestedAt: string // ISO timestamp for SLA measurement
}

export interface CampaignTriggerPayload {
  brandId: string
  campaignId: string
  memberId: string
  eventIngestedAt: string // ISO timestamp — latencyMs = Date.now() - eventIngestedAt
  sourceEventId?: string
}

export interface NotificationPayload {
  memberId: string
  brandId: string
  message: string
  channel: 'email' | 'sms'
  metadata?: Record<string, unknown>
}

export interface SentimentAnalysisPayload {
  surveyResponseId: string
  brandId: string
  memberId: string
  surveyId: string
  text: string // The open-ended response text to analyze
  eventType: string // e.g. "cx.nps_response" — used to enqueue follow-up events
  score?: number // Original numeric score (NPS/CSAT/CES)
}

export interface FeedbackClusteringPayload {
  brandId: string
  triggeredBy?: string
}

export interface SupportOrchestrationPayload {
  conversationId: string
  brandId: string
  memberId: string
  messageContent: string
}

export interface EmbeddingGenerationPayload {
  articleId: string
  brandId: string
  text: string // concatenation of title + body for embedding
}

export type {
  HealthScoreComputationPayload,
  HealthScoreWeights,
  HealthScoreBreakdown,
  HealthScoreInputs,
} from './health-score.js'

export {
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
} from './health-score.js'
