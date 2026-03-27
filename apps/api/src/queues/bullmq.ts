import { Queue, type Job, type ConnectionOptions } from 'bullmq'
import {
  QUEUES,
  type LoyaltyEventPayload,
  type CampaignTriggerPayload,
  type NotificationPayload,
  type SentimentAnalysisPayload,
  type FeedbackClusteringPayload,
} from '@customerEQ/shared'

// QUEUE_MODE=inline  → skip Redis, log and return a stub (zero Redis usage)
// QUEUE_MODE=redis   → use BullMQ queues (default)
const QUEUE_MODE = process.env.QUEUE_MODE ?? 'redis'

let _loyaltyEventsQueue: Queue | null = null
let _campaignTriggersQueue: Queue | null = null
let _notificationsQueue: Queue | null = null
let _sentimentAnalysisQueue: Queue | null = null
let _feedbackClusteringQueue: Queue | null = null
let _alertEvaluationQueue: Queue | null = null

export function initQueues(redis: ConnectionOptions): void {
  if (QUEUE_MODE === 'inline') return // no Redis needed

  const connection = redis

  _loyaltyEventsQueue = new Queue(QUEUES.LOYALTY_EVENTS, { connection })
  _campaignTriggersQueue = new Queue(QUEUES.CAMPAIGN_TRIGGERS, { connection })
  _notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, { connection })
  _sentimentAnalysisQueue = new Queue(QUEUES.SENTIMENT_ANALYSIS, { connection })
  _feedbackClusteringQueue = new Queue(QUEUES.FEEDBACK_CLUSTERING, { connection })
  _alertEvaluationQueue = new Queue(QUEUES.ALERT_EVALUATION, { connection })
}

// Stub job returned in inline mode
const INLINE_STUB = { id: 'inline' } as unknown as Job

function getLoyaltyEventsQueue(): Queue {
  if (!_loyaltyEventsQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _loyaltyEventsQueue
}

function getCampaignTriggersQueue(): Queue {
  if (!_campaignTriggersQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _campaignTriggersQueue
}

function getNotificationsQueue(): Queue {
  if (!_notificationsQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _notificationsQueue
}

function getSentimentAnalysisQueue(): Queue {
  if (!_sentimentAnalysisQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _sentimentAnalysisQueue
}

export async function enqueueEvent(
  payload: LoyaltyEventPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getLoyaltyEventsQueue().add('process', payload)
}

export async function enqueueCampaignTrigger(
  payload: CampaignTriggerPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getCampaignTriggersQueue().add('trigger', payload, { priority: 10 })
}

export async function enqueueNotification(
  payload: NotificationPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getNotificationsQueue().add('send', payload)
}

export async function enqueueSentimentAnalysis(
  payload: SentimentAnalysisPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getSentimentAnalysisQueue().add('analyze', payload)
}

function getFeedbackClusteringQueue(): Queue {
  if (!_feedbackClusteringQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _feedbackClusteringQueue
}

export async function enqueueFeedbackClustering(
  payload: FeedbackClusteringPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getFeedbackClusteringQueue().add('cluster', payload)
}

export interface AlertEvaluationPayload {
  surveyResponseId: string
  brandId: string
  memberId: string
  surveyId: string
  surveyType: string
  score: number | null
  sentiment: number | null
  topics: string[]
}

function getAlertEvaluationQueue(): Queue {
  if (!_alertEvaluationQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _alertEvaluationQueue
}

export async function enqueueAlertEvaluation(
  payload: AlertEvaluationPayload,
): Promise<Job> {
  if (QUEUE_MODE === 'inline') return INLINE_STUB
  return getAlertEvaluationQueue().add('evaluate', payload, { priority: 10 })
}
