// Mock AI client — deterministic results, zero LLM calls
// Used when AI_PROVIDER=mock or in tests

import type { AiClient } from '../types.js'
import {
  mockAnalyzeFeedback,
  mockDiscoverClusters,
  mockDetectAnomalies,
} from './fixtures.js'

export function createMockClient(): AiClient {
  return {
    async analyzeFeedback(feedbackText, surveyType, numericScore, existingClusters) {
      return mockAnalyzeFeedback(feedbackText, surveyType, numericScore, existingClusters)
    },

    async discoverClusters(unassignedFeedback, existingClusters) {
      return mockDiscoverClusters(unassignedFeedback, existingClusters)
    },

    async detectAnomalies(clusterTrends, totalLast30d, totalPrev30d) {
      return mockDetectAnomalies(clusterTrends, totalLast30d, totalPrev30d)
    },
  }
}
