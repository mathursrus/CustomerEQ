import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any import of the processor.
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => {
  // Inner transaction mock: always executes the callback with a fresh tx object.
  const makeTx = () => ({
    kBChunk: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  })

  return {
    kBSource: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    kBArticle: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    kBChunk: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx())),
  }
})
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const embedMock = vi.hoisted(() => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}))
vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => embedMock)

// ---------------------------------------------------------------------------
// Import the processor after all mocks are registered.
// ---------------------------------------------------------------------------

import { processKbIngestion } from './kbIngestion.js'

// ---------------------------------------------------------------------------
// Reset mocks between tests.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()

  // Re-apply default implementations after reset.
  prismaMock.kBSource.update.mockResolvedValue({})
  prismaMock.kBArticle.create.mockResolvedValue({ id: 'art1' })
  prismaMock.kBArticle.update.mockResolvedValue({ id: 'art1' })
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      kBChunk: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      $executeRaw: vi.fn().mockResolvedValue(1),
    }
    return fn(tx)
  })
  embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
})

// ---------------------------------------------------------------------------
// Helper to create a job-like object.
// ---------------------------------------------------------------------------

function makeJob(data: { sourceId: string; brandId: string; triggeredBy: 'MANUAL' | 'CRON' }, id = 'job1') {
  return { data, id } as never
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('kbIngestion — URL crawl', () => {
  it('fetches single URL, extracts article, creates KBArticle + KBChunks', async () => {
    prismaMock.kBSource.findUniqueOrThrow.mockResolvedValue({
      id: 'src1',
      brandId: 'b1',
      kind: 'URL',
      url: 'https://example.com/help/shipping',
      title: 'Shipping help',
      status: 'ACTIVE',
    })

    // Mock global fetch
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><body><article><h1>Shipping</h1><p>We ship to Canada via UPS.</p></article></body></html>',
    })

    prismaMock.kBArticle.findFirst.mockResolvedValue(null)
    prismaMock.kBArticle.create.mockResolvedValue({ id: 'art1' })

    await processKbIngestion(makeJob({ sourceId: 'src1', brandId: 'b1', triggeredBy: 'MANUAL' }))

    expect(prismaMock.kBArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brandId: 'b1',
          sourceId: 'src1',
          sourceUrl: 'https://example.com/help/shipping',
          status: 'PUBLISHED',
        }),
      }),
    )

    // Verify chunks were written inside a transaction (pgvector raw SQL path).
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(embedMock.generateEmbedding).toHaveBeenCalled()

    // Source updated with lastCrawledAt after success.
    expect(prismaMock.kBSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastErrorMessage: null }),
      }),
    )
  })

  it('skips re-embed when contentHash matches existing article', async () => {
    prismaMock.kBSource.findUniqueOrThrow.mockResolvedValue({
      id: 'src1',
      brandId: 'b1',
      kind: 'URL',
      url: 'https://example.com/x',
      title: 'X',
      status: 'ACTIVE',
    })

    // The HTML whose extracted body is "Same content".
    // SHA-256("Same content") = c95e7e82d691b2fa02aaf64311b4f84ff0fead94af326bbb6376c2f5b1da2117
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body><article>Same content</article></body></html>',
    })

    // Return existing article whose contentHash matches what the processor will compute.
    prismaMock.kBArticle.findFirst.mockResolvedValue({
      id: 'existing',
      contentHash: 'c95e7e82d691b2fa02aaf64311b4f84ff0fead94af326bbb6376c2f5b1da2117',
    })

    await processKbIngestion(makeJob({ sourceId: 'src1', brandId: 'b1', triggeredBy: 'MANUAL' }, 'job2'))

    // Dedup path: article was NOT re-created and no embeddings were generated.
    expect(prismaMock.kBArticle.create).not.toHaveBeenCalled()
    expect(prismaMock.kBArticle.update).not.toHaveBeenCalled()
    expect(embedMock.generateEmbedding).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('records lastErrorMessage on fetch failure and rethrows', async () => {
    prismaMock.kBSource.findUniqueOrThrow.mockResolvedValue({
      id: 'src1',
      brandId: 'b1',
      kind: 'URL',
      url: 'https://nope.example',
      title: 't',
      status: 'ACTIVE',
    })

    ;(globalThis as { fetch?: unknown }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '',
    })

    await expect(
      processKbIngestion(makeJob({ sourceId: 'src1', brandId: 'b1', triggeredBy: 'MANUAL' }, 'job3')),
    ).rejects.toThrow()

    expect(prismaMock.kBSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastErrorMessage: expect.stringMatching(/503/),
        }),
      }),
    )
  })
})
