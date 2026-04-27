import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { analyzeResponse } from './sentiment.js'
import { setAiClient, resetAiClient } from '../client.js'
import { createMockClient } from '../mocks/mock-client.js'

describe('analyzeResponse', () => {
  const previousProvider = process.env.AI_PROVIDER

  beforeEach(() => {
    // Force the legacy mock path so unit tests don't hit the real
    // BAML+Azure OpenAI gpt-5.4 client. Production default (AI_PROVIDER unset)
    // uses BAML; mock is for deterministic tests only.
    process.env.AI_PROVIDER = 'mock'
    setAiClient(createMockClient())
  })

  afterEach(() => {
    resetAiClient()
    if (previousProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = previousProvider
  })

  it('returns positive sentiment for positive feedback', async () => {
    const result = await analyzeResponse('Absolutely love the product! Fast shipping and great quality.', {
      surveyType: 'NPS',
      numericScore: 9,
    })

    expect(result.sentiment).toBeGreaterThan(0.3)
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.summary).toBeTruthy()
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('returns negative sentiment for negative feedback', async () => {
    const result = await analyzeResponse('Terrible experience. Slow shipping, broken product, and awful support.', {
      surveyType: 'CSAT',
      numericScore: 1,
    })

    expect(result.sentiment).toBeLessThan(-0.3)
    expect(result.topics.length).toBeGreaterThan(0)
  })

  it('assigns to existing cluster when matching', async () => {
    const result = await analyzeResponse('The delivery took 3 weeks, way too slow.', {
      surveyType: 'NPS',
      numericScore: 4,
      existingClusters: [
        { label: 'Shipping Delays', description: 'Complaints about delivery times' },
        { label: 'Product Quality', description: 'Feedback about product quality' },
      ],
    })

    expect(result.assignedClusterLabel).toBe('Shipping Delays')
    expect(result.suggestedNewClusterLabel).toBeNull()
  })

  it('suggests new cluster when no match', async () => {
    const result = await analyzeResponse('The checkout page crashed when I tried to pay with Apple Pay.', {
      surveyType: 'CES',
      numericScore: 2,
      existingClusters: [
        { label: 'Shipping Delays', description: 'Complaints about delivery times' },
      ],
    })

    expect(result.assignedClusterLabel).toBeNull()
    expect(result.suggestedNewClusterLabel).toBeTruthy()
  })

  it('extracts multiple topics', async () => {
    const result = await analyzeResponse('The product quality is great but the price is too high and the app crashes.', {
      surveyType: 'NPS',
      numericScore: 6,
    })

    expect(result.topics.length).toBeGreaterThanOrEqual(2)
  })

  // Issue #141: CRM notes call analyzeResponse without a numericScore (notes
  // don't have one). The mock's old blend formula compressed the text score
  // to 40% when no score was present, which collapsed every note-style call
  // to "neutral". Text-only input must now get full weight so notes land in
  // the right bucket.
  it('returns strong sentiment for note-style input (no numericScore)', async () => {
    // Three positive hits × 0.15 = 0.45 → positive bucket
    const positive = await analyzeResponse(
      'Customer said the product is amazing and they love the experience. Would recommend.',
      { surveyType: 'note' },
    )
    expect(positive.sentiment).toBeGreaterThan(0.2)

    // Three negative hits × 0.15 = 0.45 → negative bucket
    const negative = await analyzeResponse(
      'Customer said the shipping was slow and the product arrived broken. Disappointed.',
      { surveyType: 'note' },
    )
    expect(negative.sentiment).toBeLessThan(-0.2)
  })
})
