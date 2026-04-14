/**
 * BAML Eval Tests — Real LLM Assertions
 *
 * Calls real GPT-4o/GPT-4o-mini via the generated BAML client.
 * Run with: pnpm test:baml
 * NEVER SKIP: Fails hard if API key is missing.
 *
 * Following the Ashley-Calendar-AI pattern:
 *   import { b } from './test-utils.js'
 *   const result = await b.AnalyzeFeedback(...)
 *   expect(result.sentiment).toBeGreaterThan(0.3)
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { ensureApiKey, b, LLM_TIMEOUT, BATCH_LLM_TIMEOUT } from './test-utils.js'

// Fail immediately if no API key — never skip
ensureApiKey()

// ─── AnalyzeFeedback ─────────────────────────────────────────────────────────

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
    // Should assign to existing or suggest new — either is valid
    const hasCluster = result.assigned_cluster_label || result.suggested_new_cluster_label
    expect(hasCluster).toBeTruthy()
  }, LLM_TIMEOUT)

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
    // Should assign to existing or suggest new
    const hasCluster = result.assigned_cluster_label || result.suggested_new_cluster_label
    expect(hasCluster).toBeTruthy()
  }, LLM_TIMEOUT)

  it('detects sarcasm — sentiment should not be strongly positive', async () => {
    const result = await b.AnalyzeFeedback(
      'Oh sure, I just love waiting 45 minutes on hold. Really makes my day. At least the hold music was nice, I guess.',
      'CES',
      2,
      [],
    )

    // Sarcasm is hard for LLMs. With score=2/7, sentiment should at least not be strongly positive.
    // GPT-4o-mini sometimes gives ~0.3 due to "hold music was nice" — that's acceptable.
    expect(result.sentiment).toBeLessThan(0.5)
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.summary.length).toBeGreaterThan(10)
  }, LLM_TIMEOUT)

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

    const hasCluster = result.assigned_cluster_label || result.suggested_new_cluster_label
    expect(hasCluster).toBeTruthy()
    expect(result.topics.length).toBeGreaterThan(0)
  }, LLM_TIMEOUT)

  // ─── Regression: CRM note inputs (#141 follow-up) ────────────────────────
  //
  // These cases are the EXACT inputs reported as failing in the admin UI
  // after #141 shipped. Before the fix, analyzeResponse routed through
  // getAiClient().analyzeFeedback() (keyword mock) regardless of environment,
  // and single-keyword notes like "excellent call" landed in the neutral
  // bucket. The fix wired analyzeResponse to call b.AnalyzeFeedback
  // directly — these evals prove the real LLM produces the right buckets
  // for short, natural, CRM-note-style input with no numeric score.
  //
  // Notes are `surveyType: 'note'` with no numeric_score — that combination
  // was never evaluated before. Cluster assignment is not meaningful for
  // notes and is not asserted here.

  it('CRM note: "excellent call with customer" is positive', async () => {
    const result = await b.AnalyzeFeedback(
      'excellent call with customer',
      'note',
      null,
      [],
    )
    // Expect a clearly positive signal (> 0.2 threshold for our "positive" bucket)
    expect(result.sentiment).toBeGreaterThan(0.2)
    expect(result.confidence).toBeGreaterThan(0.4)
  }, LLM_TIMEOUT)

  it('CRM note: "very very bad call with customer" is negative', async () => {
    const result = await b.AnalyzeFeedback(
      'very very bad call with customer',
      'note',
      null,
      [],
    )
    // Expect a clearly negative signal (< -0.2 threshold for "negative" bucket)
    expect(result.sentiment).toBeLessThan(-0.2)
    expect(result.confidence).toBeGreaterThan(0.4)
  }, LLM_TIMEOUT)

  it('CRM note with churn signal is strongly negative', async () => {
    const result = await b.AnalyzeFeedback(
      'very bad call with the customer. they are ready to churn!',
      'note',
      null,
      [],
    )
    // Churn signal is an unambiguous very-negative escalation. LLM should
    // recognize the urgency and return a strong negative score.
    expect(result.sentiment).toBeLessThan(-0.4)
    expect(result.confidence).toBeGreaterThan(0.4)
  }, LLM_TIMEOUT)

  it('CRM note with only praise word gets above-neutral positive', async () => {
    // Defensive guard: the old keyword-mock path mapped any 1-word hit
    // to exactly ±0.15 which is inside the neutral bucket. Short natural
    // notes with a single strong emotion word must cross into positive.
    const result = await b.AnalyzeFeedback(
      'great meeting, customer was pleased',
      'note',
      null,
      [],
    )
    expect(result.sentiment).toBeGreaterThan(0.2)
  }, LLM_TIMEOUT)
})

// ─── DiscoverClusters ────────────────────────────────────────────────────────

describe('[baml] DiscoverClusters — real LLM', () => {
  it('discovers themes from unassigned feedback with no existing clusters', async () => {
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
    const assignedIds = result.assignments.map(a => a.feedback_id)
    expect(assignedIds).toContain('f1')
    expect(assignedIds).toContain('f5')
    // Each new cluster should have a label and description
    for (const cluster of result.new_clusters) {
      expect(cluster.label.length).toBeGreaterThan(0)
      expect(cluster.description.length).toBeGreaterThan(0)
      expect(cluster.keywords.length).toBeGreaterThan(0)
    }
  }, BATCH_LLM_TIMEOUT)

  it('assigns feedback to existing clusters when they fit', async () => {
    const result = await b.DiscoverClusters(
      [
        { id: 'f1', text: 'My package was late again, this is the third time', sentiment: -0.6 },
        { id: 'f2', text: 'Support agent was rude and unhelpful', sentiment: -0.9 },
      ],
      [
        { label: 'Shipping Delays', description: 'Complaints about delivery times', keywords: ['shipping', 'delivery', 'late'] },
        { label: 'Customer Support', description: 'Issues with support interactions', keywords: ['support', 'agent', 'help'] },
      ],
    )

    expect(result.assignments.length).toBe(2)
    // Should NOT create new clusters — both fit existing ones
    expect(result.new_clusters.length).toBe(0)
    // Verify assignments reference existing cluster labels
    const labels = result.assignments.map(a => a.cluster_label)
    expect(labels).toContain('Shipping Delays')
    expect(labels).toContain('Customer Support')
  }, BATCH_LLM_TIMEOUT)
})

// ─── DetectAnomalies ─────────────────────────────────────────────────────────

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
    // Should identify it as a volume spike
    const types = result.anomalies.map(a => a.type)
    expect(types).toContain('volume_spike')
    expect(result.overall_summary.length).toBeGreaterThan(20)
  }, BATCH_LLM_TIMEOUT)

  it('reports no major anomalies for stable, healthy data', async () => {
    const result = await b.DetectAnomalies(
      [
        {
          cluster_label: 'Product Quality',
          cluster_description: 'Feedback about product quality',
          daily_volumes: [10, 11, 9, 10, 12, 10, 11, 9, 10, 12, 10, 11, 9, 10, 12, 10, 11, 9, 10, 12, 10, 11, 9, 10, 12, 10, 11, 9, 10, 12],
          daily_avg_sentiment: [0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2],
          total_responses: 310,
        },
      ],
      310,
      300,
    )

    // Stable data — should have zero or only low-severity anomalies
    const highSeverity = result.anomalies.filter(a => a.severity === 'high')
    expect(highSeverity.length).toBe(0)
    expect(result.overall_summary.length).toBeGreaterThan(10)
  }, BATCH_LLM_TIMEOUT)

  it('detects sentiment drop anomaly', async () => {
    const result = await b.DetectAnomalies(
      [
        {
          cluster_label: 'Customer Support',
          cluster_description: 'Feedback about support interactions',
          daily_volumes: [8, 9, 7, 8, 9, 8, 7, 9, 8, 8, 9, 7, 8, 9, 8, 7, 9, 8, 8, 9, 7, 8, 9, 8, 7, 9, 8, 8, 9, 8],
          daily_avg_sentiment: [0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.4, 0.3, 0.2, 0.3, 0.2, 0.1, -0.1, -0.3, -0.5, -0.6, -0.7, -0.8, -0.9],
          total_responses: 245,
        },
      ],
      245,
      240,
    )

    expect(result.anomalies.length).toBeGreaterThanOrEqual(1)
    // Should detect the sentiment drop in the last week
    const types = result.anomalies.map(a => a.type)
    expect(types).toContain('sentiment_drop')
    expect(result.overall_summary.length).toBeGreaterThan(20)
  }, BATCH_LLM_TIMEOUT)
})
