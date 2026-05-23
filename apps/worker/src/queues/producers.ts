import { Queue, type Job, type ConnectionOptions } from 'bullmq'
import { QUEUES } from '@customerEQ/shared'
import type {
  LoyaltyEventPayload,
  CampaignTriggerPayload,
  NotificationPayload,
  SurveyDistributePayload,
  ExternalSignalIngestionPayload,
  WebhookDeliveryPayload,
  ManagedEmailSendPayload,
} from '@customerEQ/shared'
import { createQueue } from './definitions.js'

export async function enqueueEvent(
  connection: ConnectionOptions,
  payload: LoyaltyEventPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.LOYALTY_EVENTS, connection)
  return queue.add(QUEUES.LOYALTY_EVENTS, payload)
}

export async function enqueueCampaignTrigger(
  connection: ConnectionOptions,
  payload: CampaignTriggerPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.CAMPAIGN_TRIGGERS, connection)
  return queue.add(QUEUES.CAMPAIGN_TRIGGERS, payload, { priority: 10 })
}

export async function enqueueNotification(
  connection: ConnectionOptions,
  payload: NotificationPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.NOTIFICATIONS, connection)
  return queue.add(QUEUES.NOTIFICATIONS, payload)
}

export async function enqueueSurveyDistribute(
  connection: ConnectionOptions,
  payload: SurveyDistributePayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.SURVEY_DISTRIBUTE, connection)
  return queue.add(QUEUES.SURVEY_DISTRIBUTE, payload)
}

// Issue #420 — managed-email per-recipient dispatch. attempts=3 with exponential
// backoff for transient errors; bounce/invalid_address handled by the processor
// via the bounded failureReason (no further retry).
export async function enqueueManagedEmailSend(
  connection: ConnectionOptions,
  payload: ManagedEmailSendPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.MANAGED_EMAIL_SEND, connection)
  return queue.add(QUEUES.MANAGED_EMAIL_SEND, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })
}

export async function enqueueExternalSignalIngestion(
  connection: ConnectionOptions,
  payload: ExternalSignalIngestionPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.EXTERNAL_SIGNAL_INGESTION, connection)
  return queue.add(QUEUES.EXTERNAL_SIGNAL_INGESTION, payload)
}

export async function enqueueWebhookDelivery(
  connection: ConnectionOptions,
  payload: WebhookDeliveryPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.WEBHOOK_DELIVERY, connection)
  return queue.add('deliver', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
  })
}
