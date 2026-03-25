import { vi } from 'vitest'

type JobProcessor = (data: unknown) => Promise<unknown>

/**
 * InMemoryQueue — processes BullMQ jobs synchronously in tests.
 * Replace the BullMQ Queue/Worker with this in integration tests to
 * ensure jobs complete before assertions.
 */
export class InMemoryQueue {
  private processors = new Map<string, JobProcessor>()
  private jobs: Array<{ name: string; data: unknown; id: string }> = []

  async add(name: string, data: unknown): Promise<{ id: string }> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`
    this.jobs.push({ name, data, id })
    return { id }
  }

  register(name: string, processor: JobProcessor): void {
    this.processors.set(name, processor)
  }

  /**
   * Process all pending jobs synchronously. Call after enqueuing events in tests.
   */
  async drain(): Promise<void> {
    while (this.jobs.length > 0) {
      const job = this.jobs.shift()!
      const processor = this.processors.get(job.name)
      if (processor) {
        await processor(job.data)
      }
    }
  }

  clear(): void {
    this.jobs = []
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
