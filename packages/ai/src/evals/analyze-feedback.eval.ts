/**
 * BAML Eval Tests — Feedback Analysis
 *
 * These tests call the REAL LLM (not mock) and assert on structured output.
 * They require OPENAI_API_KEY (or ANTHROPIC_API_KEY) to be set.
 *
 * Run with: AI_PROVIDER=openai npx vitest run src/evals/ --reporter=verbose
 * Tags: baml, eval (excluded from default `pnpm test`)
 *
 * These are NOT run in CI by default — they cost money and are non-deterministic.
 * Run them manually before releases or when changing BAML prompts.
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest'
import type { AiClient } from '../types.js'
import { getAiClient, resetAiClient } from '../client.js'

// Skip entire suite if no API key is available
const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)

describe.skipIf(!hasApiKey)('BAML Eval: AnalyzeFeedback', () => {
  let client: AiClient

  beforeAll(() => {
    resetAiClient()
    // Force real client (not mock)
    process.env.AI_PROVIDER = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic'
    client = getAiClient()
  })

  it('returns positive sentiment for enthusiastic NPS feedback', async () => {
    const result = await client.analyzeFeedback(
      'Absolutely love the product! The shipping was fast and the customer support team was incredibly helpful.',
      'NPS',
      9,
      [
        { label: 'Shipping Experience', description: 'Feedback about delivery speed' },
        { label: 'Customer Support', description: 'Feedback about support interactions' },
      ],
    )

    expect(result.sentiment).toBeGreaterThan(0.3)
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.summary.length).toBeGreaterThan(10)
  }, 30_000)

  it('returns negative sentiment for angry CSAT feedback', async () => {
    const result = await client.analyzeFeedback(
      'Waited 3 weeks for my order and when it arrived the box was damaged. Called support twice and got disconnected both times. Terrible experience.',
      'CSAT',
      1,
      [
        { label: 'Shipping Delays', description: 'Complaints about delivery times' },
        { label: 'Customer Support', description: 'Feedback about support interactions' },
      ],
    )

    expect(result.sentiment).toBeLessThan(-0.3)
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.topics.length).toBeGreaterThan(0)
    // Should assign to an existing cluster since topics match
    expect(result.assignedClusterLabel).toBeTruthy()
  }, 30_000)

  it('detects sarcasm as negative sentiment', async () => {
    const result = await client.analyzeFeedback(
      'Oh sure, I just love waiting 45 minutes on hold. Really makes my day.',
      'CES',
      2,
      [],
    )

    expect(result.sentiment).toBeLessThan(0)
    // With no existing clusters, should suggest a new one
    expect(result.suggestedNewClusterLabel).toBeTruthy()
  }, 30_000)

  it('handles neutral feedback with new theme suggestion', async () => {
    const result = await client.analyzeFeedback(
      'The checkout process could use some work. Had to re-enter my address twice because the form cleared.',
      'NPS',
      6,
      [
        { label: 'Shipping Delays', description: 'Complaints about delivery times' },
        { label: 'Product Quality', description: 'Feedback about product defects' },
      ],
    )

    // Score of 6 with mild complaint = neutral-to-slightly-negative
    expect(result.sentiment).toBeGreaterThanOrEqual(-0.7)
    expect(result.sentiment).toBeLessThanOrEqual(0.3)
    // Should either assign to existing or suggest new (checkout is a new theme)
    const hasCluster = result.assignedClusterLabel || result.suggestedNewClusterLabel
    expect(hasCluster).toBeTruthy()
  }, 30_000)
})
