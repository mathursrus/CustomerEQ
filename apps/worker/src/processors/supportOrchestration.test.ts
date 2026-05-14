import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks — all upstream deps before processor import.
const prismaMock = vi.hoisted(() => ({
  conversation: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn() },
  supportRule: { findMany: vi.fn() },
  member: { findUnique: vi.fn() },
  brand: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}))
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const aiMock = vi.hoisted(() => ({
  classifySupportIntent: vi.fn(),
  draftSupportReply: vi.fn(),
}))
vi.mock('@customerEQ/ai/src/support/intent.js', () => ({ classifySupportIntent: aiMock.classifySupportIntent }))
vi.mock('@customerEQ/ai/src/support/reply.js', () => ({ draftSupportReply: aiMock.draftSupportReply }))

const embedMock = vi.hoisted(() => ({ generateEmbedding: vi.fn() }))
vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => embedMock)

const lockMock = vi.hoisted(() => ({ withConversationLock: vi.fn((_r: unknown, _c: unknown, task: () => unknown) => task()) }))
vi.mock('../lib/conversationLock.js', () => lockMock)

import { processSupportOrchestration } from './supportOrchestration.js'

beforeEach(() => {
  Object.values(prismaMock).forEach((v) => {
    if (typeof v === 'function') (v as ReturnType<typeof vi.fn>).mockReset()
    else Object.values(v as Record<string, unknown>).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  })
  aiMock.classifySupportIntent.mockReset()
  aiMock.draftSupportReply.mockReset()
  embedMock.generateEmbedding.mockReset()
  lockMock.withConversationLock.mockClear()
})

const baseJob = {
  data: {
    conversationId: 'conv1',
    brandId: 'brand1',
    memberId: 'member1',
    messageId: 'msg1',
    messageContent: 'Do you ship to Canada?',
  },
} as never

describe('supportOrchestration processor — AUTO_REPLY', () => {
  it('writes an AI message when intent matches an AUTO_REPLY rule and confidence ≥ threshold', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([
      { role: 'CUSTOMER', content: 'Do you ship to Canada?' },
    ])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null,
        topicFilters: [], conditions: {},
        actionMode: 'AUTO_REPLY', confidenceThreshold: 0.8,
        autoRespondArticleId: null, escalateToAssignee: null,
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member1', currentTier: null, pointsBalance: 100,
      email: 'a@b.com', firstName: 'A', lastName: 'B',
    })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'BrandX' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 'international_shipping',
      sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.92,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We ship to Canada via UPS', similarity: 0.91 },
    ])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada.',
      citedChunkIds: ['c1'], confidence: 0.88,
      shouldEscalate: false, reason: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 'aimsg1' })

    await processSupportOrchestration(baseJob)

    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv1',
          role: 'AI',
          content: 'Yes, we ship to Canada.',
          aiConfidence: 0.88,
          aiSources: ['c1'],
          draftedByAi: false,
        }),
      }),
    )
    expect(lockMock.withConversationLock).toHaveBeenCalledOnce()
  })

  it('falls through AUTO_REPLY when confidence < rule threshold (drops to ESCALATE if next rule)', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([{ role: 'CUSTOMER', content: '?' }])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'AUTO_REPLY', confidenceThreshold: 0.9,
        autoRespondArticleId: null, escalateToAssignee: null,
        awardPoints: null, triggerSurveyId: null,
      },
      {
        id: 'r2', status: 'ACTIVE', priority: 1,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'ESCALATE', confidenceThreshold: 0,
        autoRespondArticleId: null, escalateToAssignee: 'user_x',
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({ id: 'member1', currentTier: null, pointsBalance: 0, email: null, firstName: null, lastName: null })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'X' })
    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 't', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.7,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0))
    prismaMock.$queryRaw.mockResolvedValue([])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'x', citedChunkIds: [], confidence: 0.7, shouldEscalate: false, reason: null,
    })

    await processSupportOrchestration(baseJob)

    // Did NOT write an AI customer-visible message
    const aiCalls = prismaMock.message.create.mock.calls.filter((c) => (c[0] as { data: { role: string; draftedByAi: boolean } }).data.role === 'AI' && !(c[0] as { data: { role: string; draftedByAi: boolean } }).data.draftedByAi)
    expect(aiCalls).toHaveLength(0)
    // DID escalate
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ESCALATED', assignee: 'user_x' }),
      }),
    )
  })
})
