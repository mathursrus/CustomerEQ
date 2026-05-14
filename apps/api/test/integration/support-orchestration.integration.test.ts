/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'

// The orchestrator imports prisma directly from @customerEQ/database (not the
// Fastify plugin). Route it to the same isolated test-schema DB so all assertions
// see consistent state.
vi.mock('@customerEQ/database', async () => {
  const { getTestPrisma } = await import('@customerEQ/config/test-utils')
  return {
    get prisma() {
      return getTestPrisma()
    },
  }
})

// Mock BAML AI calls so we don't burn real LLM tokens for plumbing tests.
const aiMock = vi.hoisted(() => ({
  classifySupportIntent: vi.fn(),
  draftSupportReply: vi.fn(),
}))
vi.mock('@customerEQ/ai/src/support/intent.js', () => ({
  classifySupportIntent: aiMock.classifySupportIntent,
}))
vi.mock('@customerEQ/ai/src/support/reply.js', () => ({
  draftSupportReply: aiMock.draftSupportReply,
}))

// Mock the embedding call — we control the vector so cosine similarity is deterministic.
const embedMock = vi.hoisted(() => ({ generateEmbedding: vi.fn() }))
vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => ({
  generateEmbedding: embedMock.generateEmbedding,
}))

// ioredis is already mocked globally in test/integration/setup.ts (set → always
// returns 'OK'). The Redis constructor called inside getRedis() will get the
// in-memory mock, so withConversationLock() acquires immediately and releases.

import {
  createBrand,
  createMember,
  createConversation,
  createMessage,
  createSupportRule,
  createKBChunk,
  deterministicEmbedding,
  getTestPrisma,
} from '@customerEQ/config/test-utils'
import { processSupportOrchestration } from '../../../worker/src/processors/supportOrchestration.js'
import type { Job } from 'bullmq'

beforeEach(() => {
  aiMock.classifySupportIntent.mockReset()
  aiMock.draftSupportReply.mockReset()
  embedMock.generateEmbedding.mockReset()
})

describe('supportOrchestration — integration', () => {
  it('AUTO_REPLY end-to-end: rule match + KB retrieval + AI message written', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'BrandX' })
    const member = await createMember({ brandId: brand.id })

    const article = await prisma.kBArticle.create({
      data: {
        brandId: brand.id,
        title: 'Shipping',
        body: 'We ship globally.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    await createKBChunk({
      articleId: article.id,
      brandId: brand.id,
      chunkIndex: 0,
      content: 'We ship to Canada via UPS, 5-7 business days.',
      embedSeed: 'canada-shipping',
    })
    await createSupportRule({
      brandId: brand.id,
      intentFilters: ['shipping_question'],
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.8,
    })

    const conv = await createConversation({ brandId: brand.id, memberId: member.id })
    const userMsg = await createMessage({
      conversationId: conv.id,
      role: 'CUSTOMER',
      content: 'Do you ship to Canada?',
    })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customerSentiment: 'neutral',
      confidence: 0.92,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('canada-shipping'))
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada via UPS.',
      citedChunkIds: [],
      confidence: 0.88,
      shouldEscalate: false,
      reason: null,
    })

    await processSupportOrchestration({
      data: {
        conversationId: conv.id,
        brandId: brand.id,
        memberId: member.id,
        messageId: userMsg.id,
        messageContent: 'Do you ship to Canada?',
      },
      id: 'job1',
    } as unknown as Job)

    const aiMessages = await prisma.message.findMany({
      where: { conversationId: conv.id, role: 'AI' },
    })
    expect(aiMessages).toHaveLength(1)
    expect(aiMessages[0]).toMatchObject({
      content: 'Yes, we ship to Canada via UPS.',
      aiConfidence: 0.88,
      draftedByAi: false,
    })

    const updated = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })
    expect(updated.intent).toBe('shipping_question')
    expect(updated.topic).toBe('international_shipping')
  })

  it('tenant boundary: brand A orchestration never retrieves chunks from brand B', async () => {
    const prisma = getTestPrisma()
    const brandA = await createBrand({ name: 'A' })
    const brandB = await createBrand({ name: 'B' })
    const memberA = await createMember({ brandId: brandA.id })

    // Only brand B has chunks — brand A should see an empty KB retrieval.
    const articleB = await prisma.kBArticle.create({
      data: {
        brandId: brandB.id,
        title: 'B-only',
        body: 'secret',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    await createKBChunk({
      articleId: articleB.id,
      brandId: brandB.id,
      chunkIndex: 0,
      content: 'Brand B canada shipping info',
      embedSeed: 'canada-shipping',
    })
    await createSupportRule({
      brandId: brandA.id,
      intentFilters: ['shipping_question'],
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.5,
    })

    const convA = await createConversation({ brandId: brandA.id, memberId: memberA.id })
    const msg = await createMessage({
      conversationId: convA.id,
      role: 'CUSTOMER',
      content: 'Do you ship to Canada?',
    })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customerSentiment: 'neutral',
      confidence: 0.9,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('canada-shipping'))

    let receivedChunks: unknown[] = []
    aiMock.draftSupportReply.mockImplementation(async (input: { kbChunks: unknown[] }) => {
      receivedChunks = input.kbChunks
      return {
        reply: 'Sorry, I cannot help with that.',
        citedChunkIds: [],
        confidence: 0.8,
        shouldEscalate: false,
        reason: null,
      }
    })

    await processSupportOrchestration({
      data: {
        conversationId: convA.id,
        brandId: brandA.id,
        memberId: memberA.id,
        messageId: msg.id,
        messageContent: 'Do you ship to Canada?',
      },
      id: 'job-tenant',
    } as unknown as Job)

    // Brand A has no chunks; retrieval must return [], not B's chunks.
    expect(receivedChunks).toEqual([])
  })

  it('pgvector retrieval orders by cosine similarity within a single brand', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'PG' })
    const member = await createMember({ brandId: brand.id })
    const article = await prisma.kBArticle.create({
      data: {
        brandId: brand.id,
        title: 't',
        body: 'b',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    // Three chunks with different distance to the query vector.
    await createKBChunk({
      articleId: article.id,
      brandId: brand.id,
      chunkIndex: 0,
      content: 'far',
      embedSeed: 'far-from-query',
    })
    await createKBChunk({
      articleId: article.id,
      brandId: brand.id,
      chunkIndex: 1,
      content: 'middle',
      embedSeed: 'middle',
    })
    await createKBChunk({
      articleId: article.id,
      brandId: brand.id,
      chunkIndex: 2,
      content: 'exact',
      embedSeed: 'target-query',
    })

    await createSupportRule({
      brandId: brand.id,
      intentFilters: ['shipping_question'],
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.5,
    })

    const conv = await createConversation({ brandId: brand.id, memberId: member.id })
    const m = await createMessage({ conversationId: conv.id, role: 'CUSTOMER', content: 'q' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question',
      topic: 't',
      sensitivity: 'low',
      customerSentiment: 'neutral',
      confidence: 0.9,
    })
    // Query embedding matches 'target-query' seed exactly.
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('target-query'))

    let captured: Array<{ content: string }> = []
    aiMock.draftSupportReply.mockImplementation(async (input: { kbChunks: Array<{ content: string }> }) => {
      captured = input.kbChunks
      return {
        reply: '...',
        citedChunkIds: [],
        confidence: 0.8,
        shouldEscalate: false,
        reason: null,
      }
    })

    await processSupportOrchestration({
      data: {
        conversationId: conv.id,
        brandId: brand.id,
        memberId: member.id,
        messageId: m.id,
        messageContent: 'q',
      },
      id: 'job-pg',
    } as unknown as Job)

    // The chunk with the same seed as the query vector should be most similar.
    expect(captured[0]?.content).toBe('exact')
  })
})

describe('supportOrchestration — performance gate', () => {
  it('p95 < 3s with 10k KBChunks indexed for the brand', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'PerfBrand' })
    const member = await createMember({ brandId: brand.id })
    const article = await prisma.kBArticle.create({
      data: { brandId: brand.id, title: 't', body: 'b', status: 'PUBLISHED', publishedAt: new Date() },
    })

    // Bulk insert via raw SQL — 10k chunks chunked into 500-row batches.
    // Use deterministic embeddings for stability.
    const batch = 10000
    const chunkSize = 500
    for (let start = 0; start < batch; start += chunkSize) {
      const values: string[] = []
      const end = Math.min(start + chunkSize, batch)
      for (let i = start; i < end; i++) {
        const emb = deterministicEmbedding(`bulk-${i}`)
        // single-quote escape the id + content + vector literal — these are static strings under our control
        values.push(`('bulk_${i}', '${article.id}', '${brand.id}', ${i}, 'content ${i}', 10, '[${emb.join(',')}]'::public.vector, 'EMBEDDED', NOW(), NOW())`)
      }
      // NOTE: $executeRawUnsafe — values are interpolated, NOT user input. This is test-only seeding.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt") VALUES ${values.join(',')}`,
      )
    }

    // Update Postgres statistics after bulk insert so the query planner uses the HNSW index.
    await prisma.$executeRawUnsafe('ANALYZE "kb_chunks"')

    await createSupportRule({ brandId: brand.id, intentFilters: ['shipping_question'], actionMode: 'AUTO_REPLY', confidenceThreshold: 0.5 })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 't', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.9,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('bulk-42'))
    aiMock.draftSupportReply.mockResolvedValue({
      reply: '...', citedChunkIds: [], confidence: 0.9, shouldEscalate: false, reason: null,
    })

    // Run 5 orchestrations, take p95
    const durations: number[] = []
    for (let i = 0; i < 5; i++) {
      const conv = await createConversation({ brandId: brand.id, memberId: member.id })
      const m = await createMessage({ conversationId: conv.id, role: 'CUSTOMER', content: 'q' })
      const t0 = Date.now()
      await processSupportOrchestration({
        data: { conversationId: conv.id, brandId: brand.id, memberId: member.id, messageId: m.id, messageContent: 'q' },
        id: `perf-${i}`,
      } as never)
      durations.push(Date.now() - t0)
    }
    durations.sort((a, b) => a - b)
    const p95 = durations[Math.floor(durations.length * 0.95)]
    // eslint-disable-next-line no-console
    console.log(`Orchestrator p95: ${p95}ms (samples: ${durations.join(', ')})`)
    expect(p95).toBeLessThan(3000)
  }, 180_000)
})
