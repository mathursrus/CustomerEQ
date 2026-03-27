/**
 * BAML Eval Tests — Real LLM Assertions
 *
 * These call the REAL LLM via the generated BAML client (b.AnalyzeFeedback, etc.)
 * They require OPENAI_API_KEY to be set (GPT-4o-mini is the default client).
 *
 * Run with: pnpm test:baml (from root or packages/ai)
 * Excluded from: pnpm test, pnpm test:smoke
 * NEVER SKIP: Fails hard if OPENAI_API_KEY or ANTHROPIC_API_KEY is missing.
 *
 * Following the Ashley-Calendar-AI pattern:
 *   import { b } from '../generated/baml_client'
 *   const result = await b.AnalyzeFeedback(...)
 *   expect(result.sentiment).toBeGreaterThan(0.3)
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { b } from '../../src/generated/baml_client/index.js'

if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  throw new Error('BAML eval tests require OPENAI_API_KEY or ANTHROPIC_API_KEY to be set. These tests call real LLMs — never skip, always fail if misconfigured.')
}

describe('[baml] AnalyzeFeedback — real LLM', () => {
  it('returns positive sentiment for enthusiastic NPS feedback', async () => {
    const result = await b.AnalyzeFeedback(
      'Absolutely love the product! The shipping was fast and the customer support team was incredibly helpful when I had a question.',
      'NPS',
      9,
      [
        { label: 'Shipping Experience', description: 'Feedback about delivery speed and packaging' },
        { label: 'Customer Support', description: 'Feedback about support team interactions' },
      ],
    )

    expect(result.sentiment).toBeGreaterThan(0.2)
    expect(result.confidence).toBeGreaterThan(0.4)
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.summary.length).toBeGreaterThan(10)
    // Should assign to one of the existing clusters
    expect(result.assigned_cluster_label).toBeTruthy()
  }, 30_000)

  it('returns negative sentiment for angry CSAT feedback', async () => {
    const result = await b.AnalyzeFeedback(
      'Waited 3 weeks for my order and when it arrived the box was damaged. Called support twice and got disconnected both times. Terrible experience.',
      'CSAT',
      1,
      [
        { label: 'Shipping Delays', description: 'Complaints about long delivery times' },
        { label: 'Customer Support', description: 'Feedback about support team interactions' },
      ],
    )

    expect(result.sentiment).toBeLessThan(0)
    expect(result.confidence).toBeGreaterThan(0.4)
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.assigned_cluster_label).toBeTruthy()
  }, 30_000)

  it('detects sarcasm as non-positive sentiment', async () => {
    const result = await b.AnalyzeFeedback(
      'Oh sure, I just love waiting 45 minutes on hold. Really makes my day. At least the hold music was nice, I guess.',
      'CES',
      2,
      [],
    )

    // Sarcasm is tricky — LLM may interpret differently, but with score=2 it should lean negative
    expect(result.sentiment).toBeLessThan(0.3)
    expect(result.suggested_new_cluster_label).toBeTruthy()
  }, 30_000)

  it('suggests new cluster for unrecognized theme', async () => {
    const result = await b.AnalyzeFeedback(
      'The checkout process could use some work. Had to re-enter my address twice because the form cleared when I switched tabs.',
      'NPS',
      6,
      [
        { label: 'Shipping Delays', description: 'Complaints about long delivery times' },
        { label: 'Product Quality', description: 'Feedback about product defects or quality' },
      ],
    )

    // Checkout issues don't fit existing clusters
    const hasCluster = result.assigned_cluster_label || result.suggested_new_cluster_label
    expect(hasCluster).toBeTruthy()
    expect(result.topics.length).toBeGreaterThan(0)
  }, 30_000)
})

describe('[baml] DiscoverClusters — real LLM', () => {
  it('discovers themes from unassigned feedback', async () => {
    const result = await b.DiscoverClusters(
      [
        { id: 'f1', text: 'Shipping took way too long, 3 weeks!', sentiment: -0.7 },
        { id: 'f2', text: 'Package arrived damaged, box was crushed', sentiment: -0.8 },
        { id: 'f3', text: 'Love the product quality, really premium feel', sentiment: 0.9 },
        { id: 'f4', text: 'Price is too high for what you get', sentiment: -0.4 },
        { id: 'f5', text: 'Delivery was super fast, impressed', sentiment: 0.8 },
      ],
      [],
    )

    expect(result.new_clusters.length).toBeGreaterThanOrEqual(2)
    expect(result.assignments.length).toBe(5)
    // Every feedback item should be assigned
    const assignedIds = result.assignments.map(a => a.feedback_id)
    expect(assignedIds).toContain('f1')
    expect(assignedIds).toContain('f5')
  }, 60_000)
})

describe('[baml] DetectAnomalies — real LLM', () => {
  it('detects volume spike in trend data', async () => {
    const result = await b.DetectAnomalies(
      [
        {
          cluster_label: 'Shipping Delays',
          cluster_description: 'Complaints about delivery times',
          daily_volumes: [5, 4, 6, 5, 3, 4, 5, 6, 4, 5, 5, 4, 6, 5, 3, 4, 5, 6, 4, 5, 5, 4, 6, 5, 3, 4, 5, 6, 25, 30],
          daily_avg_sentiment: [-0.5, -0.4, -0.6, -0.5, -0.4, -0.5, -0.4, -0.6, -0.5, -0.4, -0.5, -0.4, -0.6, -0.5, -0.4, -0.5, -0.4, -0.6, -0.5, -0.4, -0.5, -0.4, -0.6, -0.5, -0.4, -0.5, -0.4, -0.6, -0.7, -0.8],
          total_responses: 175,
        },
      ],
      175,
      140,
    )

    expect(result.anomalies.length).toBeGreaterThanOrEqual(1)
    expect(result.overall_summary.length).toBeGreaterThan(20)
  }, 60_000)
})
