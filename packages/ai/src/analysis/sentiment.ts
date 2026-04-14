// Sentiment analysis using BAML-generated GPT-4o-mini client.
//
// This used to go through `getAiClient().analyzeFeedback(...)` which
// routed to a keyword-matching mock regardless of environment. That
// mock returned "neutral" for realistic short notes like
// "excellent call with customer" (only 1 matching word × 0.15 = 0.15,
// inside the neutral bucket). Fix: call BAML's `AnalyzeFeedback`
// function directly — same pattern `classify-intent.ts` already uses
// for `b.ClassifyIntent`. The BAML function has a proper nuanced
// prompt ("Be nuanced about sentiment — understand sarcasm, backhanded
// compliments, and context") that gives meaningful results.
//
// Tests that need deterministic output mock this module directly with
// vi.mock('@customerEQ/ai', ...) — see apps/api/src/routes/members-notes.test.ts.

import { b } from '../generated/baml_client/index.js'
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
  // Re-read per call so tests can flip AI_PROVIDER=mock in beforeEach.
  const useBaml = (process.env.AI_PROVIDER ?? 'baml') !== 'mock'
  // Explicit mock path for tests + local dev without OPENAI_API_KEY.
  if (!useBaml) {
    return getAiClient().analyzeFeedback(
      text,
      options.surveyType,
      options.numericScore,
      options.existingClusters ?? [],
    )
  }

  // Production / default path: real BAML + GPT-4o-mini.
  const raw = await b.AnalyzeFeedback(
    text,
    options.surveyType,
    options.numericScore ?? null,
    (options.existingClusters ?? []).map((c) => ({
      label: c.label,
      description: c.description,
    })),
  )
  // BAML uses snake_case on the wire; translate to our FeedbackAnalysisResult shape.
  return {
    sentiment: raw.sentiment,
    confidence: raw.confidence,
    topics: raw.topics,
    summary: raw.summary,
    assignedClusterLabel: raw.assigned_cluster_label ?? null,
    suggestedNewClusterLabel: raw.suggested_new_cluster_label ?? null,
  }
}
