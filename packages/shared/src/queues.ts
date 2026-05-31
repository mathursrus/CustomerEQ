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
  WEBHOOK_DELIVERY: 'webhook-delivery',
  SURVEY_DISTRIBUTE: 'survey-distribute',
  SURVEY_IMPORT: 'survey-import',
  MANAGED_EMAIL_SEND: 'managed-email-send', // Issue #420 — per-recipient ACS dispatch for MANAGED_EMAIL batches
  MEMBER_IDENTIFIER_MIGRATION: 'member-identifier-migration', // Issue #524 — async re-key worker
  MEMBER_MIGRATION_GRACE_SWEEP: 'member-migration-grace-sweep', // Issue #524 — repeatable grace-expiry sweep
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]
