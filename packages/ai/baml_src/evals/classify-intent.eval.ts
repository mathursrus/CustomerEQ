/**
 * BAML Eval Tests — ClassifyIntent Real LLM Assertions
 *
 * Calls the real Azure OpenAI `gpt-5.4` deployment via the generated BAML client.
 * Run with: pnpm test:baml
 * NEVER SKIP: Fails hard if API key is missing.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { ensureApiKey, b, LLM_TIMEOUT } from './test-utils.js'

// Fail immediately if no API key — never skip
ensureApiKey()

const VALID_INTENTS = [
  'billing', 'shipping', 'product_question', 'complaint',
  'feature_request', 'praise', 'general_inquiry',
  'account_management', 'returns_refunds',
]

const VALID_URGENCIES = ['low', 'medium', 'high', 'critical']

const sampleArticles = [
  { id: 'kb-1', title: 'Refund Policy', category: 'POLICY' },
  { id: 'kb-2', title: 'Shipping Rates & Delivery Times', category: 'FAQ' },
  { id: 'kb-3', title: 'How to Change Your Password', category: 'TROUBLESHOOTING' },
  { id: 'kb-4', title: 'Returns & Exchanges', category: 'POLICY' },
  { id: 'kb-5', title: 'Billing FAQ', category: 'FAQ' },
]

describe('[baml] ClassifyIntent — real LLM', () => {
  it('classifies billing intent — "I was charged twice for my last order"', async () => {
    const result = await b.ClassifyIntent(
      'I was charged twice for my last order',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('billing')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(VALID_URGENCIES).toContain(result.urgency)
    expect(Array.isArray(result.suggested_article_ids)).toBe(true)
    expect(result.response_outline.length).toBeGreaterThan(0)
    expect(result.reasoning.length).toBeGreaterThan(0)
  }, LLM_TIMEOUT)

  it('classifies shipping intent — "Where is my package? It\'s been 2 weeks"', async () => {
    const result = await b.ClassifyIntent(
      "Where is my package? It's been 2 weeks",
      sampleArticles,
    )

    expect(result.primary_intent).toBe('shipping')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(VALID_URGENCIES).toContain(result.urgency)
  }, LLM_TIMEOUT)

  it('classifies account management — "How do I change my password?"', async () => {
    const result = await b.ClassifyIntent(
      'How do I change my password?',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('account_management')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(VALID_URGENCIES).toContain(result.urgency)
  }, LLM_TIMEOUT)

  it('classifies complaint — "Your product is absolutely terrible"', async () => {
    const result = await b.ClassifyIntent(
      'Your product is absolutely terrible',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('complaint')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(VALID_URGENCIES).toContain(result.urgency)
  }, LLM_TIMEOUT)

  it('classifies praise — "I love your rewards program!"', async () => {
    const result = await b.ClassifyIntent(
      'I love your rewards program!',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('praise')
    expect(result.confidence).toBeGreaterThan(0.5)
  }, LLM_TIMEOUT)

  it('classifies feature request — "Can you add dark mode?"', async () => {
    const result = await b.ClassifyIntent(
      'Can you add dark mode?',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('feature_request')
    expect(result.confidence).toBeGreaterThan(0.5)
  }, LLM_TIMEOUT)

  it('classifies returns/refunds — "How do I return an item?"', async () => {
    const result = await b.ClassifyIntent(
      'How do I return an item?',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('returns_refunds')
    expect(result.confidence).toBeGreaterThan(0.5)
  }, LLM_TIMEOUT)

  it('classifies product question — "What are your shipping rates?"', async () => {
    const result = await b.ClassifyIntent(
      'What are your shipping rates?',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('product_question')
    expect(result.confidence).toBeGreaterThan(0.5)
  }, LLM_TIMEOUT)

  it('classifies general inquiry — "I need help with something"', async () => {
    const result = await b.ClassifyIntent(
      'I need help with something',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('general_inquiry')
    expect(result.confidence).toBeGreaterThan(0.5)
  }, LLM_TIMEOUT)

  it('classifies critical urgency — "My account was hacked and someone spent my points"', async () => {
    const result = await b.ClassifyIntent(
      'My account was hacked and someone spent my points',
      sampleArticles,
    )

    expect(result.primary_intent).toBe('account_management')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.urgency).toBe('critical')
  }, LLM_TIMEOUT)

  it('returns empty suggested_article_ids when no KB articles provided', async () => {
    const result = await b.ClassifyIntent(
      'I was charged twice for my last order',
      [],
    )

    expect(VALID_INTENTS).toContain(result.primary_intent)
    expect(result.suggested_article_ids).toEqual([])
  }, LLM_TIMEOUT)

  it('suggests relevant article IDs from provided KB', async () => {
    const result = await b.ClassifyIntent(
      'I was charged twice for my last order',
      sampleArticles,
    )

    // Should suggest billing-related articles
    expect(result.suggested_article_ids.length).toBeGreaterThan(0)
    expect(result.suggested_article_ids.length).toBeLessThanOrEqual(3)
    // All suggested IDs should be from the provided articles
    const validIds = sampleArticles.map(a => a.id)
    for (const id of result.suggested_article_ids) {
      expect(validIds).toContain(id)
    }
  }, LLM_TIMEOUT)
})
