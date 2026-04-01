// Types for the AI-powered feedback analysis pipeline

export interface ExistingCluster {
  label: string
  description: string
  keywords?: string[]
}

export interface FeedbackAnalysisResult {
  sentiment: number        // -1.0 to 1.0
  confidence: number       // 0.0 to 1.0
  topics: string[]         // LLM-extracted topics (free-form)
  summary: string          // One-sentence summary
  assignedClusterLabel: string | null   // Existing cluster, or null
  suggestedNewClusterLabel: string | null // New cluster suggestion, or null
}

export interface FeedbackItem {
  id: string
  text: string
  sentiment: number
}

export interface ClusterDefinition {
  id?: string
  label: string
  description: string
  keywords: string[]
}

export interface ClusterAssignment {
  feedbackId: string
  clusterLabel: string
}

export interface MergeRecommendation {
  fromLabels: string[]
  intoLabel: string
  reason: string
}

export interface ClusteringResult {
  newClusters: ClusterDefinition[]
  assignments: ClusterAssignment[]
  mergeRecommendations: MergeRecommendation[]
}

export interface ClusterTrend {
  clusterLabel: string
  clusterDescription: string
  dailyVolumes: number[]      // past 30 days
  dailyAvgSentiment: number[] // past 30 days
  totalResponses: number
}

export interface AnomalyItem {
  clusterLabel: string | null
  type: 'volume_spike' | 'sentiment_drop' | 'new_theme' | 'volume_decline'
  severity: 'low' | 'medium' | 'high'
  summary: string
}

export interface AnomalyReport {
  anomalies: AnomalyItem[]
  overallSummary: string
}

// The AI client interface — mock or real BAML client
export interface AiClient {
  analyzeFeedback(
    feedbackText: string,
    surveyType: string,
    numericScore: number | undefined,
    existingClusters: ExistingCluster[],
  ): Promise<FeedbackAnalysisResult>

  discoverClusters(
    unassignedFeedback: FeedbackItem[],
    existingClusters: ClusterDefinition[],
  ): Promise<ClusteringResult>

  detectAnomalies(
    clusterTrends: ClusterTrend[],
    totalResponsesLast30d: number,
    totalResponsesPrevious30d: number,
  ): Promise<AnomalyReport>
}
