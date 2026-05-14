import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: {
    ClassifySupportIntent: vi.fn(),
  },
}))

vi.mock('../generated/baml_client/index.js', () => bamlMock)

import { classifySupportIntent } from './intent.js'

beforeEach(() => {
  bamlMock.b.ClassifySupportIntent.mockReset()
})

describe('classifySupportIntent', () => {
  it('passes message + history through to BAML and returns the result', async () => {
    bamlMock.b.ClassifySupportIntent.mockResolvedValue({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customer_sentiment: 'neutral',
      confidence: 0.92,
    })

    const result = await classifySupportIntent({
      message: 'Do you ship to Canada?',
      history: [{ role: 'CUSTOMER', content: 'hello' }],
    })

    expect(bamlMock.b.ClassifySupportIntent).toHaveBeenCalledWith(
      'Do you ship to Canada?',
      [{ role: 'CUSTOMER', content: 'hello' }],
    )
    expect(result).toEqual({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customerSentiment: 'neutral',
      confidence: 0.92,
    })
  })
})
