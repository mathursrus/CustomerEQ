// Inline-mode runtime: schedules processor work asynchronously with retry/
// backoff semantics that match BullMQ defaults, so QUEUE_MODE=inline is
// functionally equivalent to QUEUE_MODE=redis (Redis is purely an
// optimization for throughput and cross-instance coordination — see
// docs/architecture/architecture.md §2 + §3.3).
//
// Why this exists:
// - Direct fire-and-forget (`processor(payload).catch(...)`) loses retry
//   semantics. Transient errors (DB blips, OpenAI rate limits, connector
//   timeouts) become permanent failures in inline mode. BullMQ retries
//   them with backoff; we need the same behavior here.
// - Awaiting the processor inside the API request handler would block the
//   HTTP response on background work — wrong for both modes.
// - Tests need a deterministic way to wait for in-flight inline jobs
//   before asserting on DB state. Hence `drainInlineQueue()`.

import pino from 'pino'

const log = pino({ name: 'inline-runtime' })

interface InlineJobOpts {
  /** Total attempt count (initial + retries). Default 3 to match BullMQ. */
  attempts?: number
  /** First-retry delay in ms; subsequent retries double it. Default 1000. */
  backoffMs?: number
}

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1000

const pending = new Set<Promise<void>>()

/**
 * Schedule a processor to run asynchronously after the current call stack
 * unwinds. Returns immediately — the API request handler is never blocked.
 * Errors trigger exponential-backoff retries up to `attempts`. Final failure
 * is logged structured for observability.
 *
 * Mirrors `Queue.add()` semantics: enqueue is non-blocking, processor runs
 * in the background with retries, errors do not propagate to the caller.
 */
export function scheduleInline<T>(
  jobName: string,
  payload: T,
  processor: (payload: T) => Promise<unknown>,
  opts: InlineJobOpts = {},
): void {
  const maxAttempts = opts.attempts ?? DEFAULT_ATTEMPTS
  const baseBackoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS

  const job = new Promise<void>((resolve) => {
    setImmediate(() => {
      void runWithRetries(jobName, payload, processor, maxAttempts, baseBackoffMs).then(resolve)
    })
  })
  pending.add(job)
  void job.finally(() => { pending.delete(job) })
}

async function runWithRetries<T>(
  jobName: string,
  payload: T,
  processor: (payload: T) => Promise<unknown>,
  maxAttempts: number,
  baseBackoffMs: number,
): Promise<void> {
  let attempt = 0
  let lastError: unknown
  while (attempt < maxAttempts) {
    attempt++
    try {
      await processor(payload)
      return
    } catch (err) {
      lastError = err
      if (attempt >= maxAttempts) break
      const wait = baseBackoffMs * Math.pow(2, attempt - 1)
      log.warn({ jobName, attempt, maxAttempts, waitMs: wait, err }, 'Inline job failed — retrying')
      await new Promise((r) => { setTimeout(r, wait) })
    }
  }
  log.error({ jobName, attempts: attempt, err: lastError }, 'Inline job failed after retries')
}

/**
 * Wait until every inline job that has been scheduled so far has finished
 * (success or failure). Used by tests so they can assert on DB state after
 * an enqueueX call. Production code should not call this — it would block.
 */
export async function drainInlineQueue(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled(Array.from(pending))
  }
}

/** Test helper: how many inline jobs are still in-flight. */
export function inlineQueueSize(): number {
  return pending.size
}
