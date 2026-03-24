import { Queue, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { QUEUES } from '@customerEQ/shared'

export function createConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Required for BullMQ
  })
}

export function createQueue(name: string, connection: Redis): Queue {
  return new Queue(name, { connection })
}

export { QUEUES, QueueEvents }
