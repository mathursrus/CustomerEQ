import { vi } from 'vitest'

export interface SupportIntentMock {
  intent: string
  topic: string
  sensitivity: 'low' | 'medium' | 'high'
  customerSentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
}

export interface SupportReplyMock {
  reply: string
  citedChunkIds: string[]
  confidence: number
  shouldEscalate: boolean
  reason: string | null
}

export interface SupportResolutionMock {
  resolved: boolean
  confidence: number
  reason: string
}

/**
 * Returns three configurable mock functions matching the b.* BAML interface.
 * Tests wire these via vi.mock('@customerEQ/ai/src/support/intent.js', () => ({...}))
 * patterns — see supportOrchestration.test.ts for usage (added in a later task).
 */
export function makeSupportBamlMocks(defaults?: {
  intent?: Partial<SupportIntentMock>
  reply?: Partial<SupportReplyMock>
  resolution?: Partial<SupportResolutionMock>
}) {
  const classifyIntent = vi.fn(async (): Promise<SupportIntentMock> => ({
    intent: 'unknown',
    topic: 'general',
    sensitivity: 'low',
    customerSentiment: 'neutral',
    confidence: 0.9,
    ...defaults?.intent,
  }))

  const draftReply = vi.fn(async (): Promise<SupportReplyMock> => ({
    reply: 'Mocked reply.',
    citedChunkIds: [],
    confidence: 0.9,
    shouldEscalate: false,
    reason: null,
    ...defaults?.reply,
  }))

  const classifyResolution = vi.fn(async (): Promise<SupportResolutionMock> => ({
    resolved: false,
    confidence: 0.5,
    reason: 'mocked',
    ...defaults?.resolution,
  }))

  return { classifyIntent, draftReply, classifyResolution }
}
