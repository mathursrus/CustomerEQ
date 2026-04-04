import { b } from '../generated/baml_client/index.js'
import type { IntentClassification, KBArticleSummary } from '../generated/baml_client/index.js'

/**
 * Classify a customer message into an intent category using the ClassifyIntent BAML function.
 * Returns structured classification with confidence, urgency, and suggested KB articles.
 */
export async function classifyIntent(
  message: string,
  kbArticles: KBArticleSummary[],
): Promise<IntentClassification> {
  return b.ClassifyIntent(message, kbArticles)
}

export type { IntentClassification, KBArticleSummary }
