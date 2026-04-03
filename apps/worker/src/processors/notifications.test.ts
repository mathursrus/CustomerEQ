/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { processNotification } from './notifications.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      memberId: 'member-001',
      brandId: 'brand-xyz',
      message: 'Your order has shipped!',
      channel: 'email',
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests: processNotification
// ---------------------------------------------------------------------------

describe('processNotification', () => {
  const originalEnv = process.env.EMAIL_PROVIDER

  beforeEach(() => {
    delete process.env.EMAIL_PROVIDER
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EMAIL_PROVIDER = originalEnv
    } else {
      delete process.env.EMAIL_PROVIDER
    }
  })

  it('returns sent:false with reason stub_provider when EMAIL_PROVIDER is not set', async () => {
    delete process.env.EMAIL_PROVIDER

    const result = await processNotification(makeJob() as never)

    expect(result.sent).toBe(false)
    expect(result.reason).toBe('stub_provider')
  })

  it('returns sent:false with reason stub_provider when EMAIL_PROVIDER is "stub"', async () => {
    process.env.EMAIL_PROVIDER = 'stub'

    const result = await processNotification(makeJob() as never)

    expect(result.sent).toBe(false)
    expect(result.reason).toBe('stub_provider')
  })

  it('returns the correct memberId from job data', async () => {
    const result = await processNotification(makeJob({ memberId: 'member-abc' }) as never)

    expect(result.memberId).toBe('member-abc')
  })

  it('returns the correct channel from job data', async () => {
    const result = await processNotification(makeJob({ channel: 'email' }) as never)

    expect(result.channel).toBe('email')
  })

  it('handles email channel type', async () => {
    const result = await processNotification(makeJob({ channel: 'email' }) as never)

    expect(result.channel).toBe('email')
    expect(result.memberId).toBe('member-001')
  })

  it('handles sms channel type', async () => {
    const result = await processNotification(makeJob({ channel: 'sms' }) as never)

    expect(result.channel).toBe('sms')
    expect(result.memberId).toBe('member-001')
  })

  it('returns sent:true when EMAIL_PROVIDER is a real provider', async () => {
    process.env.EMAIL_PROVIDER = 'sendgrid'

    const result = await processNotification(makeJob() as never)

    expect(result.sent).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})
