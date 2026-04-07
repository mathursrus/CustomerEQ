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
  EXTERNAL_SIGNAL_SYNC: 'external-signal-sync',
  EXTERNAL_SIGNAL_INGESTION: 'external-signal-ingestion',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]
