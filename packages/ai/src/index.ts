// @customerEQ/ai — LLM-powered feedback analysis

// Client
export { getAiClient, setAiClient, resetAiClient } from './client.js'

// Analysis functions
export { analyzeResponse } from './analysis/sentiment.js'
export { discoverClusters } from './analysis/clustering.js'
export { detectAnomalies, zScore, isVolumeAnomaly } from './analysis/anomaly.js'
export { computeTrend } from './analysis/trending.js'
export type { TrendDirection, TrendResult } from './analysis/trending.js'

// Types
export type {
  AiClient,
  ExistingCluster,
  FeedbackAnalysisResult,
  FeedbackItem,
  ClusterDefinition,
  ClusterAssignment,
  MergeRecommendation,
  ClusteringResult,
  ClusterTrend,
  AnomalyItem,
  AnomalyReport,
} from './types.js'

// Mocks (for test utilities)
export { createMockClient } from './mocks/mock-client.js'
export { MOCK_CLUSTERS, createMockAnomalies } from './mocks/fixtures.js'
