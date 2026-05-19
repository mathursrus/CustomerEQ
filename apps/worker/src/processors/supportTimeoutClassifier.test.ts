import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks — all upstream deps before processor import.
const prismaMock = vi.hoisted(() => ({
  conversation: { findMany: vi.fn() },
}))
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const aiMock = vi.hoisted(() => ({ classifyResolution: vi.fn() }))
vi.mock('@customerEQ/ai/src/support/resolution.js', () => ({ classifyResolution: aiMock.classifyResolution }))

const resolveMock = vi.hoisted(() => ({ resolveConversation: vi.fn() }))
vi.mock('@customerEQ/ai', () => resolveMock)

import { processSupportTimeoutClassifier } from './supportTimeoutClassifier.js'

beforeEach(() => {
  prismaMock.conversation.findMany.mockReset()
  aiMock.classifyResolution.mockReset()
  resolveMock.resolveConversation.mockReset()
})

const NOW = Date.now()
const THIRTY_HOURS_AGO = new Date(NOW - 30 * 60 * 60 * 1000)

describe('supportTimeoutClassifier processor', () => {
  it('case 1: no candidates — no calls to classifier or resolver', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])

    await processSupportTimeoutClassifier()

    expect(aiMock.classifyResolution).not.toHaveBeenCalled()
    expect(resolveMock.resolveConversation).not.toHaveBeenCalled()
  })

  it('case 2: last message is CUSTOMER — classifier NOT called', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-customer-last',
        brandId: 'brand1',
        memberId: 'member1',
        messages: [
          { role: 'AI', content: 'How can I help?', createdAt: THIRTY_HOURS_AGO },
          { role: 'CUSTOMER', content: 'Never mind', createdAt: THIRTY_HOURS_AGO },
        ],
      },
    ])

    await processSupportTimeoutClassifier()

    expect(aiMock.classifyResolution).not.toHaveBeenCalled()
    expect(resolveMock.resolveConversation).not.toHaveBeenCalled()
  })

  it('case 3: idle >24h, classifier confident resolved — resolveConversation called with AI_TIMEOUT', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-resolve',
        brandId: 'brand1',
        memberId: 'member1',
        messages: [
          { role: 'CUSTOMER', content: 'Can you help?', createdAt: THIRTY_HOURS_AGO },
          { role: 'AI', content: 'Sure, I have resolved your issue.', createdAt: THIRTY_HOURS_AGO },
        ],
      },
    ])
    aiMock.classifyResolution.mockResolvedValue({ resolved: true, confidence: 0.9, reason: 'Resolved' })
    resolveMock.resolveConversation.mockResolvedValue({ conversationId: 'conv-resolve', resolutionSource: 'AI_TIMEOUT', resolvedAt: new Date(), loyaltyEventEmitted: false })

    const fakeConn = { host: 'localhost', port: 6379 }
    await processSupportTimeoutClassifier(fakeConn)

    expect(aiMock.classifyResolution).toHaveBeenCalledOnce()
    expect(resolveMock.resolveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-resolve',
        source: 'AI_TIMEOUT',
      }),
      expect.objectContaining({ enqueueLoyaltyEvent: expect.any(Function) }),
    )
  })

  it('case 4: idle, classifier low confidence — resolveConversation NOT called', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-low-confidence',
        brandId: 'brand1',
        memberId: 'member1',
        messages: [
          { role: 'CUSTOMER', content: 'Question?', createdAt: THIRTY_HOURS_AGO },
          { role: 'AI', content: 'Here is your answer.', createdAt: THIRTY_HOURS_AGO },
        ],
      },
    ])
    aiMock.classifyResolution.mockResolvedValue({ resolved: true, confidence: 0.5, reason: 'Possibly resolved' })

    await processSupportTimeoutClassifier()

    expect(aiMock.classifyResolution).toHaveBeenCalledOnce()
    expect(resolveMock.resolveConversation).not.toHaveBeenCalled()
  })

  it('case 5: idle, classifier says not resolved — resolveConversation NOT called', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-not-resolved',
        brandId: 'brand1',
        memberId: 'member1',
        messages: [
          { role: 'CUSTOMER', content: 'I still need help', createdAt: THIRTY_HOURS_AGO },
          { role: 'AI', content: 'Working on it.', createdAt: THIRTY_HOURS_AGO },
        ],
      },
    ])
    aiMock.classifyResolution.mockResolvedValue({ resolved: false, confidence: 0.9, reason: 'Still open' })

    await processSupportTimeoutClassifier()

    expect(aiMock.classifyResolution).toHaveBeenCalledOnce()
    expect(resolveMock.resolveConversation).not.toHaveBeenCalled()
  })
})
