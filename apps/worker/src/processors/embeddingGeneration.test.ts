/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@customerEQ/ai', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(
    Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01)),
  ),
}))

vi.mock('@customerEQ/database', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  },
}))

import { processEmbeddingGeneration } from './embeddingGeneration.js'
import { generateEmbedding } from '@customerEQ/ai'
import { prisma } from '@customerEQ/database'
import type { Job } from 'bullmq'
import type { EmbeddingGenerationPayload } from '@customerEQ/shared'

function createMockJob(data: EmbeddingGenerationPayload): Job<EmbeddingGenerationPayload> {
  return {
    data,
    id: 'job-123',
    attemptsMade: 0,
  } as unknown as Job<EmbeddingGenerationPayload>
}

describe('processEmbeddingGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates embedding and stores it via raw SQL', async () => {
    const job = createMockJob({
      articleId: 'art-1',
      brandId: 'brand-1',
      text: 'Refund Policy\n\nWe offer refunds within 30 days.',
    })

    const result = await processEmbeddingGeneration(job)

    expect(generateEmbedding).toHaveBeenCalledWith('Refund Policy\n\nWe offer refunds within 30 days.')
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kb_articles SET embedding'),
      expect.stringContaining('['),
      'art-1',
    )
    expect(result.articleId).toBe('art-1')
    expect(result.dimensions).toBe(1536)
  })

  it('propagates embedding generation errors', async () => {
    vi.mocked(generateEmbedding).mockRejectedValueOnce(new Error('OpenAI API rate limit'))

    const job = createMockJob({
      articleId: 'art-2',
      brandId: 'brand-1',
      text: 'Test content',
    })

    await expect(processEmbeddingGeneration(job)).rejects.toThrow('OpenAI API rate limit')
  })

  it('propagates database write errors', async () => {
    vi.mocked(prisma.$executeRawUnsafe).mockRejectedValueOnce(new Error('DB connection lost'))

    const job = createMockJob({
      articleId: 'art-3',
      brandId: 'brand-1',
      text: 'Test content',
    })

    await expect(processEmbeddingGeneration(job)).rejects.toThrow('DB connection lost')
  })
})
