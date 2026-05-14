/**
 * BAML Eval Tests — DraftSupportReply Real LLM Assertions
 *
 * Tests KB grounding, citation, escalation, and no-hallucination properties.
 * Run with: pnpm test:baml
 * NEVER SKIP: Fails hard if API key is missing.
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest'
import { ensureApiKey } from './test-utils.js'
import { draftSupportReply } from '../../src/support/reply.js'

// Fail immediately if no API key — never skip
ensureApiKey()

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error(
      'AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests',
    )
  }
})

describe('eval: DraftSupportReply', () => {
  it('grounds the reply in provided KB chunks and cites them', async () => {
    const r = await draftSupportReply({
      message: 'Do you ship to Canada?',
      history: [],
      kbChunks: [
        {
          id: 'c1',
          articleId: 'a1',
          chunkIndex: 0,
          content: 'We ship to Canada via UPS Ground, typically 5-7 business days.',
          similarity: 0.91,
        },
        {
          id: 'c2',
          articleId: 'a2',
          chunkIndex: 0,
          content: 'Returns must be initiated within 30 days.',
          similarity: 0.41,
        },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    expect(r.shouldEscalate).toBe(false)
    expect(r.citedChunkIds).toContain('c1')
    expect(r.reply.toLowerCase()).toMatch(/canada/)
  }, 90_000)

  it('escalates when chunks do not cover the question', async () => {
    const r = await draftSupportReply({
      message: 'Can you process my refund for the laptop I bought three years ago?',
      history: [],
      kbChunks: [
        {
          id: 'c1',
          articleId: 'a1',
          chunkIndex: 0,
          content: 'Standard refund window is 30 days from purchase.',
          similarity: 0.55,
        },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    expect(r.shouldEscalate).toBe(true)
    expect(r.reason).toBeTruthy()
  }, 90_000)

  it('does not fabricate a price or URL that is not in the chunks', async () => {
    const r = await draftSupportReply({
      message: 'How much does shipping cost?',
      history: [],
      kbChunks: [
        {
          id: 'c1',
          articleId: 'a1',
          chunkIndex: 0,
          content: 'We offer free shipping on orders over a certain threshold.',
          similarity: 0.8,
        },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    expect(r.reply).not.toMatch(/\$\d+/)
    expect(r.reply).not.toMatch(/https?:\/\//)
  }, 90_000)
})
