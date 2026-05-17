import { vi } from 'vitest'
import { deterministicEmbedding } from '../factories/kbChunk.factory.js'

/**
 * Mocks @customerEQ/ai's generateEmbedding to produce stable vectors per input.
 * Call before any module-under-test imports generateEmbedding (use vi.hoisted).
 */
export function mockOpenAIEmbed() {
  vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => ({
    generateEmbedding: vi.fn(async (text: string) => deterministicEmbedding(text)),
  }))
}
