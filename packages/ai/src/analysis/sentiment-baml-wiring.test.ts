/// <reference types="vitest" />
// Unit-level regression guard: makes sure analyzeResponse is actually
// routed through the BAML client (b.AnalyzeFeedback), NOT the legacy
// keyword-matching mock.
//
// Why this test exists
// --------------------
// Before the #141 follow-up fix, analyzeResponse called
// getAiClient().analyzeFeedback() unconditionally. That path always
// returns a keyword-matching mock regardless of AI_PROVIDER, so the
// production auto-sentiment feature was returning "neutral" for
// realistic short notes like "excellent call with customer". The
// BAML-backed AnalyzeFeedback function was generated and ready — just
// never wired up.
//
// This test mocks b.AnalyzeFeedback, calls analyzeResponse, and asserts
// the mock was invoked with the right arguments and that its return
// value flows through. Running this test against the pre-fix code
// would fail because analyzeResponse wouldn't call b.AnalyzeFeedback at
// all — it'd use the keyword mock from getAiClient() and return a
// different shape with different values.
//
// This is a behavioral wiring test. Semantic "does GPT-4o-mini actually
// classify natural language correctly" tests live in the BAML evals
// (packages/ai/baml_src/evals/analyze-feedback.eval.ts) and run via
// `pnpm test:baml` with a real OPENAI_API_KEY.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the BAML client module. Vitest hoists vi.mock above imports.
vi.mock('../generated/baml_client/index.js', () => ({
  b: {
    AnalyzeFeedback: vi.fn(),
  },
}))

import { b } from '../generated/baml_client/index.js'
import { analyzeResponse } from './sentiment.js'

const mockedAnalyzeFeedback = vi.mocked(b.AnalyzeFeedback)

describe('analyzeResponse → BAML wiring', () => {
  const originalProvider = process.env.AI_PROVIDER

  beforeEach(() => {
    // Force the production path (default). Without this the test could
    // be accidentally tricked into the mock path by a stray env var.
    delete process.env.AI_PROVIDER
    mockedAnalyzeFeedback.mockReset()
  })

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = originalProvider
  })

  it('calls b.AnalyzeFeedback (not the keyword mock) in the default path', async () => {
    mockedAnalyzeFeedback.mockResolvedValue({
      sentiment: 0.75,
      confidence: 0.9,
      topics: ['customer success'],
      summary: 'Positive call with customer',
      assigned_cluster_label: null,
      suggested_new_cluster_label: null,
    })

    const result = await analyzeResponse('excellent call with customer', {
      surveyType: 'note',
    })

    // Proof that we went through BAML, not getAiClient().analyzeFeedback
    expect(mockedAnalyzeFeedback).toHaveBeenCalledOnce()
    // The result must be the value BAML returned (0.75), NOT whatever
    // the keyword mock would have scored (0.15 for a single "excellent").
    expect(result.sentiment).toBe(0.75)
    expect(result.confidence).toBe(0.9)
    expect(result.topics).toEqual(['customer success'])
    expect(result.summary).toBe('Positive call with customer')
  })

  it('passes surveyType, numericScore, and clusters through to BAML unchanged', async () => {
    mockedAnalyzeFeedback.mockResolvedValue({
      sentiment: 0.4,
      confidence: 0.85,
      topics: [],
      summary: 'ok',
      assigned_cluster_label: null,
      suggested_new_cluster_label: null,
    })

    await analyzeResponse('some feedback', {
      surveyType: 'NPS',
      numericScore: 9,
      existingClusters: [
        { label: 'Shipping', description: 'Shipping-related' },
        { label: 'Product', description: 'Product quality' },
      ],
    })

    // BAML signature: (text, surveyType, numericScore|null, existingClusters)
    expect(mockedAnalyzeFeedback).toHaveBeenCalledWith(
      'some feedback',
      'NPS',
      9,
      [
        { label: 'Shipping', description: 'Shipping-related' },
        { label: 'Product', description: 'Product quality' },
      ],
    )
  })

  it('passes null (not undefined) for missing numericScore — BAML wire format', async () => {
    mockedAnalyzeFeedback.mockResolvedValue({
      sentiment: 0,
      confidence: 0.5,
      topics: [],
      summary: '',
      assigned_cluster_label: null,
      suggested_new_cluster_label: null,
    })

    await analyzeResponse('a plain note', { surveyType: 'note' })

    const call = mockedAnalyzeFeedback.mock.calls[0]
    // Third arg is numericScore — must be explicitly null for BAML when
    // absent, not undefined or 0. BAML's wire format treats null as
    // "no score given" and undefined can cause validation errors.
    expect(call[2]).toBeNull()
    // Fourth arg must be an empty array, not undefined
    expect(call[3]).toEqual([])
  })

  it('maps BAML snake_case fields to camelCase output shape', async () => {
    mockedAnalyzeFeedback.mockResolvedValue({
      sentiment: -0.6,
      confidence: 0.92,
      topics: ['churn risk'],
      summary: 'Customer ready to churn',
      assigned_cluster_label: 'At-Risk Customers',
      suggested_new_cluster_label: null,
    })

    const result = await analyzeResponse(
      'very bad call with the customer. they are ready to churn!',
      { surveyType: 'note' },
    )

    // Our FeedbackAnalysisResult uses camelCase; BAML returns snake_case.
    // The translation layer must preserve values.
    expect(result.assignedClusterLabel).toBe('At-Risk Customers')
    expect(result.suggestedNewClusterLabel).toBeNull()
    expect(result.sentiment).toBe(-0.6)
    expect(result.topics).toEqual(['churn risk'])
  })

  it('does NOT call b.AnalyzeFeedback when AI_PROVIDER=mock (legacy escape hatch)', async () => {
    process.env.AI_PROVIDER = 'mock'

    // Any non-empty text goes through the keyword mock path
    const result = await analyzeResponse('some feedback text', {
      surveyType: 'note',
    })

    expect(mockedAnalyzeFeedback).not.toHaveBeenCalled()
    // Mock path still returns a valid shape (exact value doesn't matter
    // here — the point is BAML was bypassed)
    expect(typeof result.sentiment).toBe('number')
  })
})
