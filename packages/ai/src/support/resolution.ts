import { b } from '../generated/baml_client/index.js'

export interface ClassifyResolutionInput {
  messages: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  hoursSinceLast: number
}

export interface ClassifyResolutionResult {
  resolved: boolean
  confidence: number
  reason: string
}

export async function classifyResolution(
  input: ClassifyResolutionInput,
): Promise<ClassifyResolutionResult> {
  const raw = await b.ClassifyResolution(input.messages, input.hoursSinceLast)
  return {
    resolved: raw.resolved,
    confidence: raw.confidence,
    reason: raw.reason,
  }
}
