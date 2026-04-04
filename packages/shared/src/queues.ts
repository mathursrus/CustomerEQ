export const QUEUES = {
  LOYALTY_EVENTS: 'loyalty-events',
  CAMPAIGN_TRIGGERS: 'campaign-triggers',
  NOTIFICATIONS: 'notifications',
  SENTIMENT_ANALYSIS: 'sentiment-analysis',
  FEEDBACK_CLUSTERING: 'feedback-clustering',
  ALERT_EVALUATION: 'alert-evaluation',
  EMBEDDING_GENERATION: 'embedding-generation',
=======
  HEALTH_SCORE_COMPUTATION: 'health-score-computation',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]
