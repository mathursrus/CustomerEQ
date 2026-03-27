// Enhanced sentiment analysis using AI client
// Replaces the keyword heuristic with LLM-powered analysis

import { getAiClient } from '../client.js'
import type { ExistingCluster, FeedbackAnalysisResult } from '../types.js'

export async function analyzeResponse(
  text: string,
  options: {
    surveyType: string
    numericScore?: number
    existingClusters?: ExistingCluster[]
  },
): Promise<FeedbackAnalysisResult> {
  const client = getAiClient()

  return client.analyzeFeedback(
    text,
    options.surveyType,
    options.numericScore,
    options.existingClusters ?? [],
  )
}
