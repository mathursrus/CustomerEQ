import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withConversationLock } from './conversationLock.js'

interface FakeRedis {
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

function makeRedis(setReturns: Array<'OK' | null>): FakeRedis {
  const setMock = vi.fn()
  setReturns.forEach((v) => setMock.mockResolvedValueOnce(v))
  return { set: setMock, del: vi.fn().mockResolvedValue(1) }
}

beforeEach(() => { vi.useRealTimers() })

describe('withConversationLock', () => {
  it('runs the task when the lock is acquired on first try', async () => {
    const redis = makeRedis(['OK'])
    const task = vi.fn().mockResolvedValue('done')
    const result = await withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 10, maxRetries: 0 })
    expect(result).toBe('done')
    expect(task).toHaveBeenCalledOnce()
    expect(redis.set).toHaveBeenCalledWith('lock:conv:conv1', expect.any(String), 'PX', 30000, 'NX')
    expect(redis.del).toHaveBeenCalledOnce()
  })

  it('retries when the lock is held, then succeeds', async () => {
    const redis = makeRedis([null, null, 'OK'])
    const task = vi.fn().mockResolvedValue('done')
    const result = await withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 1, maxRetries: 5 })
    expect(result).toBe('done')
    expect(redis.set).toHaveBeenCalledTimes(3)
  })

  it('throws when max retries exhausted', async () => {
    const redis = makeRedis([null, null, null])
    await expect(
      withConversationLock(redis as never, 'conv1', vi.fn(), { ttlMs: 30000, retryDelayMs: 1, maxRetries: 2 }),
    ).rejects.toThrow(/could not acquire/i)
  })

  it('releases the lock even if the task throws', async () => {
    const redis = makeRedis(['OK'])
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 1, maxRetries: 0 })).rejects.toThrow('boom')
    expect(redis.del).toHaveBeenCalledOnce()
  })
})
