import { Queue, Job } from 'bullmq'
import type Redis from 'ioredis'
import { QUEUES } from '@customerEQ/shared'
import type { LoyaltyEventPayload, CampaignTriggerPayload, NotificationPayload } from '@customerEQ/shared'
import { createQueue } from './definitions.js'

export async function enqueueEvent(
  connection: Redis,
  payload: LoyaltyEventPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.LOYALTY_EVENTS, connection)
  return queue.add(QUEUES.LOYALTY_EVENTS, payload)
}

export async function enqueueCampaignTrigger(
  connection: Redis,
  payload: CampaignTriggerPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.CAMPAIGN_TRIGGERS, connection)
  return queue.add(QUEUES.CAMPAIGN_TRIGGERS, payload, { priority: 10 })
}

export async function enqueueNotification(
  connection: Redis,
  payload: NotificationPayload,
): Promise<Job> {
  const queue: Queue = createQueue(QUEUES.NOTIFICATIONS, connection)
  return queue.add(QUEUES.NOTIFICATIONS, payload)
}
