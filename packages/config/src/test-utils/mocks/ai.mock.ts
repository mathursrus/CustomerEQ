// Vitest mock helpers for @customerEQ/ai
// Usage: import { mockAi, clearAiMock } from '@customerEQ/config/test-utils'

import { vi } from 'vitest'

export const mockAnalyzeResponse = vi.fn().mockResolvedValue({
  sentiment: 0.6,
  confidence: 0.9,
  topics: ['product quality'],
  summary: 'Positive feedback about product quality.',
  assignedClusterLabel: 'Product Quality',
  suggestedNewClusterLabel: null,
})

export const mockDiscoverClusters = vi.fn().mockResolvedValue({
  newClusters: [],
  assignments: [],
  mergeRecommendations: [],
})

export const mockDetectAnomalies = vi.fn().mockResolvedValue({
  anomalies: [],
  overallSummary: 'No anomalies detected.',
})

export function mockNegativeAnalysis() {
  mockAnalyzeResponse.mockResolvedValueOnce({
    sentiment: -0.7,
    confidence: 0.85,
    topics: ['shipping delays', 'customer support'],
    summary: 'Negative feedback about shipping delays and poor support.',
    assignedClusterLabel: 'Shipping Delays',
    suggestedNewClusterLabel: null,
  })
}

export function mockNewClusterAnalysis() {
  mockAnalyzeResponse.mockResolvedValueOnce({
    sentiment: -0.3,
    confidence: 0.8,
    topics: ['checkout process'],
    summary: 'Mixed feedback about the checkout experience.',
    assignedClusterLabel: null,
    suggestedNewClusterLabel: 'Checkout Issues',
  })
}

export const mockGenerateEmbedding = vi.fn().mockResolvedValue(
  Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01)),
)

export const mockClassifyIntent = vi.fn().mockResolvedValue({
  primary_intent: 'billing',
  confidence: 0.92,
  urgency: 'high',
  suggested_article_ids: [],
  response_outline: 'Acknowledge the billing issue and offer to investigate the duplicate charge.',
  reasoning: 'The customer mentions being charged twice, indicating a billing/payment issue.',
})

export function clearAiMock() {
  mockAnalyzeResponse.mockClear()
  mockDiscoverClusters.mockClear()
  mockDetectAnomalies.mockClear()
  mockGenerateEmbedding.mockClear()
  mockClassifyIntent.mockClear()
}
