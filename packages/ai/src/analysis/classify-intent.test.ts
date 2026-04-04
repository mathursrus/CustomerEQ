/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the BAML client
vi.mock('../generated/baml_client/index.js', () => ({
  b: {
    ClassifyIntent: vi.fn().mockResolvedValue({
      primary_intent: 'billing',
      confidence: 0.92,
      urgency: 'high',
      suggested_article_ids: ['art-1', 'art-2'],
      response_outline: 'Acknowledge the billing issue and offer to investigate.',
      reasoning: 'Customer mentions being charged twice, indicating billing issue.',
    }),
  },
}))

import { classifyIntent } from './classify-intent.js'
import { b } from '../generated/baml_client/index.js'

describe('classifyIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns structured intent classification', async () => {
    const result = await classifyIntent('I was charged twice', [])

    expect(result.primary_intent).toBe('billing')
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.urgency).toBe('high')
    expect(result.response_outline).toBeTruthy()
    expect(result.reasoning).toBeTruthy()
  })

  it('passes message and KB articles to BAML client', async () => {
    const articles = [
      { id: 'art-1', title: 'Refund Policy', category: 'POLICY' },
      { id: 'art-2', title: 'Billing FAQ', category: 'FAQ' },
    ]

    await classifyIntent('I was charged twice', articles)

    expect(b.ClassifyIntent).toHaveBeenCalledWith('I was charged twice', articles)
  })

  it('returns suggested article IDs when KB articles are provided', async () => {
    const result = await classifyIntent('I was charged twice', [
      { id: 'art-1', title: 'Refund Policy', category: 'POLICY' },
    ])

    expect(Array.isArray(result.suggested_article_ids)).toBe(true)
    expect(result.suggested_article_ids.length).toBeGreaterThan(0)
  })

  it('propagates BAML errors', async () => {
    vi.mocked(b.ClassifyIntent).mockRejectedValueOnce(new Error('LLM unavailable'))

    await expect(classifyIntent('test', [])).rejects.toThrow('LLM unavailable')
  })
})
