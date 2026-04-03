import { vi } from 'vitest'

/**
 * Returns a pino mock factory suitable for use with vi.mock('pino').
 * Usage:
 *   import { pinoMockFactory } from '@customerEQ/config/test-utils'
 *   vi.mock('pino', () => pinoMockFactory())
 */
export function pinoMockFactory() {
  return {
    default: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }),
  }
}
