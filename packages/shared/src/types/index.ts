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
  surveyResponseId?: string // set when triggered by a survey response (Issue #80)
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

export interface SurveyDistributePayload {
  surveyId: string
  memberId: string
  brandId: string
  triggerKey: string
  surveyLink: string
  cooldownDays: number
}

export interface SurveyImportRowPayload {
  batchId: string
  surveyId: string
  brandId: string
  rowIndex: number
  sourceType: 'excel' | 'google_reviews'
  email: string | null
  score: number | null
  verbatim: string | null
  completedAt: string // ISO 8601
  channel: string
  externalId: string | null
  rawAnswers: Record<string, unknown>
}

export interface ExternalSignalSyncPayload {
  brandId: string
  sourceId: string
  triggeredBy?: string
  reason?: 'manual' | 'scheduled'
}

export interface ExternalSignalIngestionPayload {
  brandId: string
  sourceId: string
  deliveries: Record<string, unknown>[]
  receivedAt: string
  deliveryType?: 'webhook' | 'sync'
}

export interface WebhookDeliveryPayload {
  webhookEndpointId: string
  brandId: string
  event: 'case.created' | 'case.status_changed' | 'case.overdue'
  caseId: string
  data: Record<string, unknown>
}

export type {
  HealthScoreComputationPayload,
  HealthScoreWeights,
  HealthScoreBreakdown,
  HealthScoreInputs,
  NoteSentiment,
} from './health-score.js'

export {
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  NOTE_SENTIMENT_VALUES,
  NOTE_SENTIMENT_MODIFIERS,
  computeRecencyScore,
  computeFrequencyScore,
  computeSentimentScore,
  computeNpsScore,
  computeEngagementScore,
  computeHealthScore,
} from './health-score.js'
