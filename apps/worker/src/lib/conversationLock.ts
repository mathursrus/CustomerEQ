import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'

export interface ConversationLockOptions {
  ttlMs: number
  retryDelayMs: number
  maxRetries: number
}

export async function withConversationLock<T>(
  redis: Redis,
  conversationId: string,
  task: () => Promise<T>,
  opts: ConversationLockOptions,
): Promise<T> {
  const key = `lock:conv:${conversationId}`
  const token = randomUUID()

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const ok = await redis.set(key, token, 'PX', opts.ttlMs, 'NX')
    if (ok === 'OK') {
      try {
        return await task()
      } finally {
        try {
          await redis.del(key)
        } catch {
          // best effort; TTL will reclaim
        }
      }
    }
    if (attempt < opts.maxRetries) {
      await new Promise((r) => setTimeout(r, opts.retryDelayMs))
    }
  }

  throw new Error(`Could not acquire conversation lock for ${conversationId} after ${opts.maxRetries + 1} attempts`)
}
