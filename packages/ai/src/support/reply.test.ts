import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: { DraftSupportReply: vi.fn() },
}))
vi.mock('../generated/baml_client/index.js', () => bamlMock)

import { draftSupportReply } from './reply.js'

beforeEach(() => bamlMock.b.DraftSupportReply.mockReset())

describe('draftSupportReply', () => {
  it('forwards chunks + history + brand voice to BAML, returns shaped result', async () => {
    bamlMock.b.DraftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada.',
      cited_chunk_ids: ['c1', 'c3'],
      confidence: 0.88,
      should_escalate: false,
      reason: null,
    })

    const result = await draftSupportReply({
      message: 'Do you ship to Canada?',
      history: [],
      kbChunks: [
        { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We ship to Canada via UPS.', similarity: 0.91 },
        { id: 'c3', articleId: 'a1', chunkIndex: 2, content: 'Delivery 5-7 business days.', similarity: 0.78 },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise. Use "we" not "the company".',
    })

    expect(bamlMock.b.DraftSupportReply).toHaveBeenCalledOnce()
    expect(result).toEqual({
      reply: 'Yes, we ship to Canada.',
      citedChunkIds: ['c1', 'c3'],
      confidence: 0.88,
      shouldEscalate: false,
      reason: null,
    })
  })
})
