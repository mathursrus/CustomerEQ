export const QUEUES = {
  LOYALTY_EVENTS: 'loyalty-events',
  CAMPAIGN_TRIGGERS: 'campaign-triggers',
  NOTIFICATIONS: 'notifications',
  SENTIMENT_ANALYSIS: 'sentiment-analysis',
  FEEDBACK_CLUSTERING: 'feedback-clustering',
  ALERT_EVALUATION: 'alert-evaluation',
  SUPPORT_ORCHESTRATION: 'support-orchestration',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]
