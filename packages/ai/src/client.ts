// AI client factory — switches between mock and real BAML client
// AI_PROVIDER=mock  → deterministic mock (zero LLM calls)
// AI_PROVIDER=anthropic → real BAML-generated client (requires ANTHROPIC_API_KEY)

import type { AiClient } from './types.js'
import { createMockClient } from './mocks/mock-client.js'

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'mock'

let _client: AiClient | null = null

export function getAiClient(): AiClient {
  if (_client) return _client

  if (AI_PROVIDER === 'mock') {
    _client = createMockClient()
    return _client
  }

  // For 'anthropic' provider, use the BAML-generated client
  // TODO: Wire up BAML generated client once `baml-cli generate` is run
  // For now, fall back to mock with a warning
  console.warn(
    `AI_PROVIDER=${AI_PROVIDER} but BAML client not yet generated. Falling back to mock.`,
  )
  _client = createMockClient()
  return _client
}

// Allow tests/initialization to override the client
export function setAiClient(client: AiClient): void {
  _client = client
}

export function resetAiClient(): void {
  _client = null
}
