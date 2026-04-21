/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest'
import { scheduleInline, drainInlineQueue, inlineQueueSize } from './inlineRuntime.js'

describe('inlineRuntime', () => {
  it('runs the processor asynchronously and reports zero pending after drain', async () => {
    const processor = vi.fn().mockResolvedValue(undefined)
    scheduleInline('test-job', { foo: 1 }, processor)

    // Returns synchronously — processor has not yet run on this tick
    expect(processor).not.toHaveBeenCalled()
    expect(inlineQueueSize()).toBe(1)

    await drainInlineQueue()

    expect(processor).toHaveBeenCalledTimes(1)
    expect(processor).toHaveBeenCalledWith({ foo: 1 })
    expect(inlineQueueSize()).toBe(0)
  })

  it('retries on error with backoff and eventually succeeds', async () => {
    let attempts = 0
    const processor = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 3) throw new Error(`fail attempt ${attempts}`)
      return { ok: true }
    })

    // Use 1ms backoff so the test runs fast
    scheduleInline('flaky-job', null, processor, { attempts: 5, backoffMs: 1 })
    await drainInlineQueue()

    expect(processor).toHaveBeenCalledTimes(3)
    expect(inlineQueueSize()).toBe(0)
  })

  it('exhausts attempts on persistent failure and stays bounded', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('always fails'))

    scheduleInline('doomed-job', null, processor, { attempts: 3, backoffMs: 1 })
    await drainInlineQueue()

    expect(processor).toHaveBeenCalledTimes(3)
    expect(inlineQueueSize()).toBe(0)
  })

  it('drains multiple concurrent jobs', async () => {
    const processor = vi.fn().mockResolvedValue(undefined)
    for (let i = 0; i < 10; i++) {
      scheduleInline(`job-${i}`, { i }, processor)
    }
    expect(inlineQueueSize()).toBe(10)

    await drainInlineQueue()

    expect(processor).toHaveBeenCalledTimes(10)
    expect(inlineQueueSize()).toBe(0)
  })

  it('does not propagate processor errors to the caller', async () => {
    // The whole point of scheduleInline is fire-and-forget with retries —
    // the caller (API request handler) must never see the error.
    const processor = vi.fn().mockRejectedValue(new Error('boom'))

    expect(() => scheduleInline('error-job', null, processor, { attempts: 1, backoffMs: 1 })).not.toThrow()
    await drainInlineQueue()

    expect(processor).toHaveBeenCalledTimes(1)
  })
})
