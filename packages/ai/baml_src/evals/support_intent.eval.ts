/**
 * BAML Eval Tests — ClassifySupportIntent Real LLM Assertions
 *
 * 30-case labeled eval set. Hits Azure OpenAI via the generated BAML client.
 * Run with: pnpm test:baml
 * NEVER SKIP: Fails hard if API key is missing.
 *
 * Accuracy bars:
 *   - Intent accuracy  : >=90%  (27/30)
 *   - Sensitivity acc  : >=85%  (25.5/30 → 26/30)
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest'
import { ensureApiKey } from './test-utils.js'
import { classifySupportIntent } from '../../src/support/intent.js'

// Fail immediately if no API key — never skip
ensureApiKey()

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error(
      'AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests — these tests do not skip',
    )
  }
})

const cases: Array<{
  message: string
  expectIntent: string
  expectSensitivity: 'low' | 'medium' | 'high'
}> = [
  { message: 'Do you ship to Canada?', expectIntent: 'shipping_question', expectSensitivity: 'low' },
  { message: 'What are your hours?', expectIntent: 'store_hours', expectSensitivity: 'low' },
  { message: 'Where is my order #1234?', expectIntent: 'order_status', expectSensitivity: 'low' },
  { message: 'I want a refund for order #1234', expectIntent: 'refund_request', expectSensitivity: 'high' },
  { message: 'Cancel my account', expectIntent: 'account_cancellation', expectSensitivity: 'high' },
  { message: 'I was double-charged', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'How do I return this item?', expectIntent: 'returns', expectSensitivity: 'medium' },
  { message: 'Reset my password please', expectIntent: 'password_reset', expectSensitivity: 'medium' },
  { message: 'Your product broke after one day, this is unacceptable', expectIntent: 'complaint', expectSensitivity: 'high' },
  { message: 'Just wanted to say thank you for the great service', expectIntent: 'compliment', expectSensitivity: 'low' },
  { message: 'Do you have this in red?', expectIntent: 'product_inquiry', expectSensitivity: 'low' },
  { message: 'Why was my coupon code rejected?', expectIntent: 'promo_code_issue', expectSensitivity: 'medium' },
  { message: 'My subscription renewed without notice', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'Where do I download my invoice?', expectIntent: 'invoice_request', expectSensitivity: 'low' },
  { message: 'How do I change my shipping address?', expectIntent: 'account_update', expectSensitivity: 'medium' },
  { message: 'Item arrived broken', expectIntent: 'damaged_item', expectSensitivity: 'high' },
  { message: 'Can I exchange size M for L?', expectIntent: 'exchange_request', expectSensitivity: 'medium' },
  { message: 'Do you offer student discounts?', expectIntent: 'discount_inquiry', expectSensitivity: 'low' },
  { message: 'Privacy policy question', expectIntent: 'privacy_inquiry', expectSensitivity: 'medium' },
  { message: 'I would like to delete my account and all my data', expectIntent: 'data_deletion_request', expectSensitivity: 'high' },
  { message: 'Quick question about gift cards', expectIntent: 'gift_card_inquiry', expectSensitivity: 'low' },
  { message: "Order placed yesterday hasn't shipped", expectIntent: 'order_status', expectSensitivity: 'low' },
  { message: 'Wrong item delivered', expectIntent: 'wrong_item', expectSensitivity: 'high' },
  { message: 'Can I add a gift note?', expectIntent: 'gifting_question', expectSensitivity: 'low' },
  { message: 'Loyalty program tier question', expectIntent: 'loyalty_inquiry', expectSensitivity: 'low' },
  { message: 'Can a human help me please', expectIntent: 'agent_request', expectSensitivity: 'medium' },
  { message: 'I think my card was charged twice', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'What payment methods do you accept?', expectIntent: 'payment_methods', expectSensitivity: 'low' },
  { message: 'Do you ship to Australia?', expectIntent: 'shipping_question', expectSensitivity: 'low' },
  { message: 'How do I track my package?', expectIntent: 'order_status', expectSensitivity: 'low' },
]

describe('eval: ClassifySupportIntent', () => {
  it('hits >=90% intent accuracy and >=85% sensitivity accuracy across the labeled set', async () => {
    let intentHits = 0
    let sensitivityHits = 0

    for (const c of cases) {
      const r = await classifySupportIntent({ message: c.message, history: [] })
      if (r.intent === c.expectIntent) intentHits++
      if (r.sensitivity === c.expectSensitivity) sensitivityHits++
    }

    const intentAcc = intentHits / cases.length
    const sensAcc = sensitivityHits / cases.length

    // eslint-disable-next-line no-console
    console.log(
      `Intent: ${intentHits}/${cases.length} (${(intentAcc * 100).toFixed(1)}%) | ` +
      `Sensitivity: ${sensitivityHits}/${cases.length} (${(sensAcc * 100).toFixed(1)}%)`,
    )

    expect(intentAcc).toBeGreaterThanOrEqual(0.9)
    expect(sensAcc).toBeGreaterThanOrEqual(0.85)
  }, 180_000)
})
