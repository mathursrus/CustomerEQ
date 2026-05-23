import { vi } from 'vitest'

export const mockBamlAnalyzeFeedback = vi.fn()
export const mockBamlDiscoverClusters = vi.fn()
export const mockBamlGenerateEmbedding = vi.fn()
export const mockBamlClassifyIntent = vi.fn()

/**
 * Returns a mock factory for the generated BAML client module.
 * Usage:
 *   import { bamlClientMockFactory } from '@customerEQ/config/test-utils'
 *   vi.mock('../generated/baml_client/index.js', () => bamlClientMockFactory())
 */
export function bamlClientMockFactory() {
  return {
    b: {
      AnalyzeFeedback: mockBamlAnalyzeFeedback,
      DiscoverClusters: mockBamlDiscoverClusters,
      GenerateEmbedding: mockBamlGenerateEmbedding,
      ClassifyIntent: mockBamlClassifyIntent,
    },
  }
}

export function clearBamlMocks() {
  mockBamlAnalyzeFeedback.mockReset()
  mockBamlDiscoverClusters.mockReset()
  mockBamlGenerateEmbedding.mockReset()
  mockBamlClassifyIntent.mockReset()
}
