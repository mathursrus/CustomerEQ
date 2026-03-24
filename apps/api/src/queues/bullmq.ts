import { Queue, type Job } from 'bullmq'
import type Redis from 'ioredis'
import {
  QUEUES,
  type LoyaltyEventPayload,
  type CampaignTriggerPayload,
  type NotificationPayload,
} from '@customerEQ/shared'

let _loyaltyEventsQueue: Queue<LoyaltyEventPayload> | null = null
let _campaignTriggersQueue: Queue<CampaignTriggerPayload> | null = null
let _notificationsQueue: Queue<NotificationPayload> | null = null

export function initQueues(redis: Redis): void {
  const connection = redis

  _loyaltyEventsQueue = new Queue<LoyaltyEventPayload>(QUEUES.LOYALTY_EVENTS, {
    connection,
  })

  _campaignTriggersQueue = new Queue<CampaignTriggerPayload>(
    QUEUES.CAMPAIGN_TRIGGERS,
    { connection },
  )

  _notificationsQueue = new Queue<NotificationPayload>(QUEUES.NOTIFICATIONS, {
    connection,
  })
}

function getLoyaltyEventsQueue(): Queue<LoyaltyEventPayload> {
  if (!_loyaltyEventsQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _loyaltyEventsQueue
}

function getCampaignTriggersQueue(): Queue<CampaignTriggerPayload> {
  if (!_campaignTriggersQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _campaignTriggersQueue
}

function getNotificationsQueue(): Queue<NotificationPayload> {
  if (!_notificationsQueue) {
    throw new Error('Queues have not been initialized. Call initQueues(redis) first.')
  }
  return _notificationsQueue
}

export async function enqueueEvent(
  payload: LoyaltyEventPayload,
): Promise<Job<LoyaltyEventPayload>> {
  return getLoyaltyEventsQueue().add('process', payload)
}

export async function enqueueCampaignTrigger(
  payload: CampaignTriggerPayload,
): Promise<Job<CampaignTriggerPayload>> {
  return getCampaignTriggersQueue().add('trigger', payload, { priority: 10 })
}

export async function enqueueNotification(
  payload: NotificationPayload,
): Promise<Job<NotificationPayload>> {
  return getNotificationsQueue().add('send', payload)
}
