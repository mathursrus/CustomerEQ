import { vi } from 'vitest'

type JobProcessor = (job: { id: string; data: unknown; name: string }) => Promise<unknown>

interface QueuedJob {
  name: string
  data: unknown
  id: string
  processed?: boolean
  result?: unknown
}

/**
 * InMemoryQueue — processes BullMQ jobs synchronously in tests.
 * All methods are static so tests can call InMemoryQueue.clear(), .drain(), etc.
 */
export class InMemoryQueue {
  private static processors = new Map<string, JobProcessor>()
  private static jobs: QueuedJob[] = []

  static async add(name: string, data: unknown): Promise<{ id: string }> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`
    InMemoryQueue.jobs.push({ name, data, id })
    return { id }
  }

  static register(name: string, processor: JobProcessor): void {
    InMemoryQueue.processors.set(name, processor)
  }

  /**
   * Process all pending jobs for the given queue name synchronously.
   */
  static async drain(queueName?: string): Promise<void> {
    const pending = InMemoryQueue.jobs.filter(
      (j) => !j.processed && (queueName ? j.name === queueName : true),
    )
    for (const job of pending) {
      const processor = InMemoryQueue.processors.get(job.name)
      if (processor) {
        job.result = await processor({ id: job.id, data: job.data, name: job.name })
      }
      job.processed = true
    }
  }

  /** Return all jobs (pending + processed) for a given queue name. */
  static getJobs(queueName?: string): QueuedJob[] {
    return queueName
      ? InMemoryQueue.jobs.filter((j) => j.name === queueName)
      : [...InMemoryQueue.jobs]
  }

  /** Return only processed jobs for a given queue name. */
  static getProcessedJobs(queueName?: string): QueuedJob[] {
    return InMemoryQueue.getJobs(queueName).filter((j) => j.processed)
  }

  static clear(): void {
    InMemoryQueue.jobs = []
  }
}

/**
 * Creates a mock BullMQ Queue that records calls without actually connecting to Redis.
 */
export function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'mock_job_id' }),
    close: vi.fn().mockResolvedValue(undefined),
  }
}
