import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { analyzeResponse } from './sentiment.js'
import { setAiClient, resetAiClient } from '../client.js'
import { createMockClient } from '../mocks/mock-client.js'

describe('analyzeResponse', () => {
  beforeEach(() => {
    setAiClient(createMockClient())
  })

  afterEach(() => {
    resetAiClient()
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
})
