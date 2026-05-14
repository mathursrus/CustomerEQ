import { b } from '../generated/baml_client/index.js'

export interface ClassifySupportIntentInput {
  message: string
  history: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
}

export interface ClassifySupportIntentResult {
  intent: string
  topic: string
  sensitivity: 'low' | 'medium' | 'high'
  customerSentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
}

export async function classifySupportIntent(
  input: ClassifySupportIntentInput,
): Promise<ClassifySupportIntentResult> {
  const raw = await b.ClassifySupportIntent(input.message, input.history)
  return {
    intent: raw.intent,
    topic: raw.topic,
    sensitivity: raw.sensitivity,
    customerSentiment: raw.customer_sentiment,
    confidence: raw.confidence,
  }
}
