/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Route @customerEQ/database → the isolated test-schema PrismaClient so all
// assertions (and the processor itself) see the same DB state.
// ---------------------------------------------------------------------------
vi.mock('@customerEQ/database', async () => {
  const { getTestPrisma } = await import('@customerEQ/config/test-utils')
  return {
    get prisma() {
      return getTestPrisma()
    },
  }
})

// ---------------------------------------------------------------------------
// Mock rebuildArticleChunks — write real chunks to the real test DB but use a
// deterministic embedding instead of calling OpenAI.
//
// The internal import chain is:
//   kbIngestion.ts → @customerEQ/ai/src/kb/chunks.js → ../analysis/embeddings.js
// Vitest resolves the inner relative import as a different module-registry key
// than '@customerEQ/ai/src/analysis/embeddings.js', so mocking the leaf path
// does not intercept the call. We mock the chunks module instead and provide a
// real implementation that delegates to the factory's deterministicEmbedding.
// ---------------------------------------------------------------------------
vi.mock('@customerEQ/ai/src/kb/chunks.js', async () => {
  const { getTestPrisma, deterministicEmbedding } = await import('@customerEQ/config/test-utils')
  const { chunkArticleBody } = await import('@customerEQ/shared')

  async function rebuildArticleChunks(
    articleId: string,
    brandId: string,
    body: string,
  ): Promise<number> {
    const prisma = getTestPrisma()
    if (!body.trim()) {
      await prisma.kBChunk.deleteMany({ where: { articleId } })
      return 0
    }
    const chunks = chunkArticleBody(body, { targetTokens: 500, overlapTokens: 100 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.kBChunk.deleteMany({ where: { articleId } })
      for (const c of chunks) {
        const embedding = deterministicEmbedding(c.content)
        const vec = `[${embedding.join(',')}]`
        await tx.$executeRaw`
          INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt")
          VALUES (${`chunk_${articleId}_${c.chunkIndex}`}, ${articleId}, ${brandId}, ${c.chunkIndex}, ${c.content}, ${c.tokenCount}, ${vec}::public.vector, 'EMBEDDED'::"ChunkEmbedStatus", NOW(), NOW())
        `
      }
    }, { timeout: 60_000 })
    return chunks.length
  }

  return { rebuildArticleChunks }
})

// ---------------------------------------------------------------------------
// fetch spy — replaced per-test to control HTTP responses.
// ---------------------------------------------------------------------------
const fetchSpy = vi.fn()

// ---------------------------------------------------------------------------
// Imports — after all vi.mock() calls.
// ---------------------------------------------------------------------------
import { createBrand, createKBSource, getTestPrisma } from '@customerEQ/config/test-utils'
import { processKbIngestion } from '../../../worker/src/processors/kbIngestion.js'
import type { Job } from 'bullmq'

// ---------------------------------------------------------------------------
// Per-test reset.
// ---------------------------------------------------------------------------
beforeEach(() => {
  fetchSpy.mockReset()
  ;(globalThis as { fetch?: unknown }).fetch = fetchSpy
})

// ---------------------------------------------------------------------------
// Sample HTML — includes enough text that Readability/cheerio extracts a
// non-empty article body so chunking fires.
// ---------------------------------------------------------------------------
const sampleHtml = `<html><body><article>
  <h1>Shipping</h1>
  <p>We ship to Canada via UPS, typically 5-7 business days.</p>
  <p>International orders may require customs documentation.</p>
  <p>All packages are insured up to $100 by default.</p>
</article></body></html>`

// ---------------------------------------------------------------------------
// Helper — job-like object matching what BullMQ passes to the processor.
// ---------------------------------------------------------------------------
function makeJob(
  data: { sourceId: string; brandId: string; triggeredBy: 'MANUAL' | 'CRON' },
  id = 'ingest-1',
) {
  return { data, id } as unknown as Job
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('kbIngestion — integration', () => {
  it('URL crawl end-to-end: creates KBArticle + KBChunks, marks source crawled', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'IngestBrandA' })
    const source = await createKBSource({
      brandId: brand.id,
      kind: 'URL',
      url: 'https://example.com/help/shipping',
      title: 'Shipping help',
    })

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => sampleHtml,
    } as unknown)

    await processKbIngestion(makeJob({ sourceId: source.id, brandId: brand.id, triggeredBy: 'MANUAL' }))

    // Article assertions
    const article = await prisma.kBArticle.findFirst({
      where: { brandId: brand.id, sourceId: source.id },
    })
    expect(article).toBeTruthy()
    expect(article!.sourceUrl).toBe('https://example.com/help/shipping')
    expect(article!.status).toBe('PUBLISHED')
    expect(article!.contentHash).toBeTruthy()
    expect(article!.publishedAt).toBeTruthy()

    // Chunk assertions
    const chunks = await prisma.kBChunk.findMany({
      where: { articleId: article!.id },
      orderBy: { chunkIndex: 'asc' },
    })
    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.brandId).toBe(brand.id)
      expect(c.embedStatus).toBe('EMBEDDED')
      expect(c.content.length).toBeGreaterThan(0)
    }

    // Source state assertions
    const refreshedSource = await prisma.kBSource.findUniqueOrThrow({ where: { id: source.id } })
    expect(refreshedSource.lastCrawledAt).toBeTruthy()
    expect(refreshedSource.lastErrorMessage).toBeNull()
  })

  it('is idempotent: same content → no new article or chunks on second run', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'IngestBrandB' })
    const source = await createKBSource({
      brandId: brand.id,
      kind: 'URL',
      url: 'https://example.com/idempotent',
      title: 'idempotent test',
    })

    // First crawl
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, text: async () => sampleHtml } as unknown)
    await processKbIngestion(makeJob({ sourceId: source.id, brandId: brand.id, triggeredBy: 'MANUAL' }, 'ingest-2a'))

    const articlesBefore = await prisma.kBArticle.count({ where: { brandId: brand.id } })
    const chunksBefore = await prisma.kBChunk.count({ where: { brandId: brand.id } })
    expect(articlesBefore).toBe(1)
    expect(chunksBefore).toBeGreaterThan(0)

    const sourceMidway = await prisma.kBSource.findUniqueOrThrow({ where: { id: source.id } })
    const firstCrawledAt = sourceMidway.lastCrawledAt

    // Small pause so lastCrawledAt can advance if the processor updates it
    await new Promise((r) => setTimeout(r, 10))

    // Second crawl — identical HTML body
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, text: async () => sampleHtml } as unknown)
    await processKbIngestion(makeJob({ sourceId: source.id, brandId: brand.id, triggeredBy: 'MANUAL' }, 'ingest-2b'))

    const articlesAfter = await prisma.kBArticle.count({ where: { brandId: brand.id } })
    const chunksAfter = await prisma.kBChunk.count({ where: { brandId: brand.id } })

    // No new articles or chunks — content hash matched, idempotent skip
    expect(articlesAfter).toBe(articlesBefore)
    expect(chunksAfter).toBe(chunksBefore)

    // lastCrawledAt is updated even on a skip (source still crawled successfully)
    const refreshed = await prisma.kBSource.findUniqueOrThrow({ where: { id: source.id } })
    expect(refreshed.lastCrawledAt).toBeTruthy()
    expect(refreshed.lastErrorMessage).toBeNull()
    // The processor updates lastCrawledAt at the outer level after the per-URL
    // idempotent skip, so it should be >= the first crawledAt.
    expect(refreshed.lastCrawledAt!.getTime()).toBeGreaterThanOrEqual(firstCrawledAt!.getTime())
  })

  it('records lastErrorMessage on fetch failure and rethrows', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'IngestBrandC' })
    const source = await createKBSource({
      brandId: brand.id,
      kind: 'URL',
      url: 'https://broken.example/x',
      title: 'broken',
    })

    fetchSpy.mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' } as unknown)

    await expect(
      processKbIngestion(makeJob({ sourceId: source.id, brandId: brand.id, triggeredBy: 'MANUAL' }, 'ingest-3')),
    ).rejects.toThrow()

    const refreshed = await prisma.kBSource.findUniqueOrThrow({ where: { id: source.id } })
    expect(refreshed.lastErrorMessage).toMatch(/503/)
  })
})
