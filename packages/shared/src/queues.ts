export const QUEUES = {
  LOYALTY_EVENTS: 'loyalty-events',
  CAMPAIGN_TRIGGERS: 'campaign-triggers',
  NOTIFICATIONS: 'notifications',
  SENTIMENT_ANALYSIS: 'sentiment-analysis',
  FEEDBACK_CLUSTERING: 'feedback-clustering',
  ALERT_EVALUATION: 'alert-evaluation',
  SUPPORT_ORCHESTRATION: 'support-orchestration',
  EMBEDDING_GENERATION: 'embedding-generation',
  HEALTH_SCORE_COMPUTATION: 'health-score-computation',
  SURVEY_DISTRIBUTE: 'survey-distribute', // Issue #117 — triggered survey distribution
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]
