/**
 * BAML Eval Tests — ClassifyResolution Real LLM Assertions
 *
 * 20-case labeled eval set across resolved / not-resolved / edge categories.
 * Run with: pnpm test:baml
 * NEVER SKIP: Fails hard if API key is missing.
 *
 * Accuracy bars:
 *   - Overall accuracy       : >=85%  (17/20)
 *   - False-resolved rate    : <5%    (must catch most "not resolved" correctly)
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest'
import { ensureApiKey } from './test-utils.js'
import { classifyResolution } from '../../src/support/resolution.js'

// Fail immediately if no API key — never skip
ensureApiKey()

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error(
      'AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests',
    )
  }
})

const cases: Array<{
  label: string
  messages: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  hoursSinceLast: number
  expectResolved: boolean
}> = [
  // ── RESOLVED (8 cases) ──────────────────────────────────────────────────────

  {
    // Customer explicitly acknowledges the answer worked
    label: 'thanks-that-worked',
    messages: [
      { role: 'CUSTOMER', content: 'how do I reset my password?' },
      { role: 'AI', content: 'click forgot password on the login page' },
      { role: 'CUSTOMER', content: 'thanks, that worked' },
    ],
    hoursSinceLast: 26,
    expectResolved: true,
  },
  {
    // Long silence (48h) after a clear, complete answer — no follow-up
    label: 'silent-after-clear-answer',
    messages: [
      { role: 'CUSTOMER', content: 'do you ship to Canada?' },
      { role: 'AI', content: 'yes, via UPS, 5-7 days' },
    ],
    hoursSinceLast: 48,
    expectResolved: true,
  },
  {
    // Customer says "got it" — explicit affirmation
    label: 'got-it-affirmation',
    messages: [
      { role: 'CUSTOMER', content: 'what is your return window?' },
      { role: 'AGENT', content: 'you have 30 days from the delivery date to initiate a return' },
      { role: 'CUSTOMER', content: 'got it, thanks!' },
    ],
    hoursSinceLast: 10,
    expectResolved: true,
  },
  {
    // Customer explicitly closes the ticket themselves
    label: 'customer-closes-ticket',
    messages: [
      { role: 'CUSTOMER', content: 'never mind, I figured it out on my own' },
    ],
    hoursSinceLast: 5,
    expectResolved: true,
  },
  {
    // Strong explicit acknowledgment — "perfect, exactly what I needed"
    label: 'perfect-exactly-what-i-needed',
    messages: [
      { role: 'CUSTOMER', content: 'can I use two promo codes at once?' },
      { role: 'AI', content: 'no, only one promo code can be applied per order' },
      { role: 'CUSTOMER', content: 'perfect, exactly what I needed to know' },
    ],
    hoursSinceLast: 3,
    expectResolved: true,
  },
  {
    // 36h silence after agent gave a full and complete tracking answer
    label: 'silent-after-tracking-answer',
    messages: [
      { role: 'CUSTOMER', content: 'where is my order #5678?' },
      { role: 'AGENT', content: 'your order is out for delivery and should arrive today by 8pm' },
    ],
    hoursSinceLast: 36,
    expectResolved: true,
  },
  {
    // Customer marks it solved with emoji + text
    label: 'thumbs-up-solved',
    messages: [
      { role: 'CUSTOMER', content: 'how do I update my billing address?' },
      { role: 'AI', content: 'go to account settings > billing > update address' },
      { role: 'CUSTOMER', content: 'done! all sorted' },
    ],
    hoursSinceLast: 12,
    expectResolved: true,
  },
  {
    // Customer said "no further questions" — unambiguous resolution
    label: 'no-further-questions',
    messages: [
      { role: 'CUSTOMER', content: 'what are the hours for your live chat support?' },
      { role: 'AI', content: 'live chat is available Monday through Friday, 9am to 6pm EST' },
      { role: 'CUSTOMER', content: 'great, no further questions' },
    ],
    hoursSinceLast: 8,
    expectResolved: true,
  },

  // ── NOT RESOLVED (8 cases) ──────────────────────────────────────────────────

  {
    // Agent promised a future action — still pending
    label: 'follow-up-pending',
    messages: [
      { role: 'CUSTOMER', content: 'I want a refund' },
      { role: 'AGENT', content: "I'll process that and you should see it in 3-5 days" },
    ],
    hoursSinceLast: 26,
    expectResolved: false,
  },
  {
    // Customer raised a follow-up question after the answer
    label: 'follow-up-question',
    messages: [
      { role: 'CUSTOMER', content: 'can I return a gift?' },
      { role: 'AI', content: 'yes, gifts can be returned within 30 days with or without a receipt' },
      { role: 'CUSTOMER', content: 'what if I only have a gift receipt? do I get store credit or cash?' },
    ],
    hoursSinceLast: 2,
    expectResolved: false,
  },
  {
    // Answer was partial — customer asked for clarification
    label: 'partial-answer-clarification',
    messages: [
      { role: 'CUSTOMER', content: 'how long does shipping take?' },
      { role: 'AI', content: 'it depends on your location and the shipping method chosen' },
      { role: 'CUSTOMER', content: 'can you be more specific? I am in Texas' },
    ],
    hoursSinceLast: 1,
    expectResolved: false,
  },
  {
    // Customer hasn't acknowledged yet AND hoursSinceLast is very short
    label: 'no-ack-short-wait',
    messages: [
      { role: 'CUSTOMER', content: 'is the red version of the bag back in stock?' },
      { role: 'AI', content: 'yes! the red tote bag is back in stock as of today' },
    ],
    hoursSinceLast: 0.5,
    expectResolved: false,
  },
  {
    // Customer said "let me think about it" — deferred, not resolved
    label: 'let-me-think',
    messages: [
      { role: 'CUSTOMER', content: 'should I get the annual plan or monthly?' },
      { role: 'AI', content: 'annual saves you 20% — great if you plan to use us long-term' },
      { role: 'CUSTOMER', content: "ok, let me think about it and I'll get back to you" },
    ],
    hoursSinceLast: 4,
    expectResolved: false,
  },
  {
    // Agent promised escalation to a specialist — action still pending
    label: 'escalation-pending',
    messages: [
      { role: 'CUSTOMER', content: 'my account was hacked and there are unauthorized charges' },
      { role: 'AGENT', content: "I'm escalating this to our fraud team — they'll contact you within 24 hours" },
    ],
    hoursSinceLast: 5,
    expectResolved: false,
  },
  {
    // Customer asked a new unrelated question mid-thread — not resolved
    label: 'new-question-mid-thread',
    messages: [
      { role: 'CUSTOMER', content: 'where is my order #9999?' },
      { role: 'AI', content: 'order #9999 shipped yesterday and is arriving tomorrow' },
      { role: 'CUSTOMER', content: 'ok thanks. also — do you have a mobile app?' },
    ],
    hoursSinceLast: 1,
    expectResolved: false,
  },
  {
    // Only 10h silence after a potentially insufficient answer
    label: 'short-silence-ambiguous-answer',
    messages: [
      { role: 'CUSTOMER', content: 'why was my order cancelled?' },
      { role: 'AI', content: 'orders can be cancelled for various reasons including payment issues or inventory' },
    ],
    hoursSinceLast: 10,
    expectResolved: false,
  },

  // ── EDGE CASES (4 cases) ────────────────────────────────────────────────────

  {
    // Customer thanked agent but for a tangential thing, not the original question
    // The original question (refund status) was never actually answered.
    // Label: NOT resolved — the "thanks" was for a side note, not the core issue.
    label: 'thanks-for-wrong-thing',
    messages: [
      { role: 'CUSTOMER', content: 'what is the status of my refund for order #321?' },
      { role: 'AGENT', content: "I can see your order. Also, your loyalty points expire next month — just a heads up!" },
      { role: 'CUSTOMER', content: 'oh thanks for the heads up on the points!' },
    ],
    hoursSinceLast: 6,
    expectResolved: false,
  },
  {
    // Refund acknowledged ("I will process it") vs refund actually processed
    // The agent confirmed they WILL process it — action still pending.
    // Label: NOT resolved — promise made but not fulfilled.
    label: 'refund-acknowledged-not-processed',
    messages: [
      { role: 'CUSTOMER', content: "I still haven't received my refund from last week" },
      { role: 'AGENT', content: "I've submitted the refund request. It should appear in 5-7 business days." },
    ],
    hoursSinceLast: 24,
    expectResolved: false,
  },
  {
    // "Thanks anyway" — frustrated giving-up, issue not actually resolved
    // Label: NOT resolved — the phrase signals resignation, not satisfaction.
    label: 'thanks-anyway-frustrated',
    messages: [
      { role: 'CUSTOMER', content: 'I need to change my order before it ships — can you help?' },
      { role: 'AI', content: "I'm sorry, once an order is confirmed we cannot make changes to it" },
      { role: 'CUSTOMER', content: 'fine, thanks anyway' },
    ],
    hoursSinceLast: 5,
    expectResolved: false,
  },
  {
    // Multiple questions in thread — one answered (hours), one still open (refund amount)
    // Customer has not acknowledged AND follow-up question still open.
    // Label: NOT resolved — at least one question remains unanswered.
    label: 'multiple-questions-one-answered',
    messages: [
      { role: 'CUSTOMER', content: 'how long does the refund take, and how much will I get back?' },
      { role: 'AI', content: 'refunds typically take 5-7 business days to appear on your statement' },
    ],
    hoursSinceLast: 2,
    expectResolved: false,
  },
]

describe('eval: ClassifyResolution', () => {
  it('hits >=85% accuracy with <5% false-resolved rate', async () => {
    if (cases.length < 20) {
      throw new Error(
        `Eval set has ${cases.length} cases; need >=20 for statistical sanity`,
      )
    }

    let correct = 0
    let falseResolved = 0
    let actualNotResolved = 0

    for (const c of cases) {
      const r = await classifyResolution({ messages: c.messages, hoursSinceLast: c.hoursSinceLast })
      if (r.resolved === c.expectResolved) correct++
      if (r.resolved && !c.expectResolved) falseResolved++
      if (!c.expectResolved) actualNotResolved++
    }

    const acc = correct / cases.length
    const fpRate = actualNotResolved > 0 ? falseResolved / actualNotResolved : 0

    // eslint-disable-next-line no-console
    console.log(
      `Resolution acc: ${(acc * 100).toFixed(1)}% | ` +
      `False-resolved rate: ${(fpRate * 100).toFixed(1)}%`,
    )

    expect(acc).toBeGreaterThanOrEqual(0.85)
    expect(fpRate).toBeLessThan(0.05)
  }, 240_000)
})
