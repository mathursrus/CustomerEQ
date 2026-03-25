import { Queue, type Job, type ConnectionOptions } from 'bullmq'
import {
  QUEUES,
  type LoyaltyEventPayload,
  type CampaignTriggerPayload,
  type NotificationPayload,
} from '@customerEQ/shared'

let _loyaltyEventsQueue: Queue | null = null
let _campaignTriggersQueue: Queue | null = null
let _notificationsQueue: Queue | null = null

export function initQueues(redis: ConnectionOptions): void {
  const connection = redis

  _loyaltyEventsQueue = new Queue(QUEUES.LOYALTY_EVENTS, { connection })
  _campaignTriggersQueue = new Queue(QUEUES.CAMPAIGN_TRIGGERS, { connection })
  _notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, { connection })
}

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

export async function enqueueEvent(
  payload: LoyaltyEventPayload,
): Promise<Job> {
  return getLoyaltyEventsQueue().add('process', payload)
}

export async function enqueueCampaignTrigger(
  payload: CampaignTriggerPayload,
): Promise<Job> {
  return getCampaignTriggersQueue().add('trigger', payload, { priority: 10 })
}

export async function enqueueNotification(
  payload: NotificationPayload,
): Promise<Job> {
  return getNotificationsQueue().add('send', payload)
}
