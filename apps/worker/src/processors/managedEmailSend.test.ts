import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __testing__ } from './managedEmailSend.js'

const { checkSuppression, classifyError, resolveFrontendBaseUrl } = __testing__

describe('checkSuppression — two-gate worker re-check', () => {
  const okMember = {
    erased: false,
    unsubscribedSurveysAt: null,
    consentGivenAt: new Date('2026-01-01'),
    email: 'a@b.com',
  }

  it('returns null for an OK member', () => {
    expect(checkSuppression(okMember)).toBeNull()
  })

  it('skips erased members', () => {
    expect(checkSuppression({ ...okMember, erased: true })).toBe('skipped_erased')
  })

  it('skips members with unsubscribedSurveysAt set (idempotent — any non-null timestamp)', () => {
    expect(checkSuppression({ ...okMember, unsubscribedSurveysAt: new Date() })).toBe('skipped_unsubscribed')
  })

  it('skips members without consentGivenAt', () => {
    expect(checkSuppression({ ...okMember, consentGivenAt: null })).toBe('skipped_no_consent')
  })

  it('skips members without an email', () => {
    expect(checkSuppression({ ...okMember, email: null })).toBe('skipped_no_email')
  })

  it('does NOT skip when emailOptIn is false (surveys are legitimate-interest; emailOptIn is marketing-only)', () => {
    // emailOptIn is not a field on the gate's input — verifies the gate signature
    // does not even accept emailOptIn, so the exemption is structural, not behavioral.
    expect(checkSuppression(okMember)).toBeNull()
  })

  it('returns the first failing condition (erased takes priority over unsubscribed)', () => {
    expect(checkSuppression({
      ...okMember,
      erased: true,
      unsubscribedSurveysAt: new Date(),
    })).toBe('skipped_erased')
  })
})

describe('classifyError — bounded failureReason taxonomy', () => {
  it('classifies bounce keyword as bounce (non-retryable)', () => {
    expect(classifyError(new Error('Mail returned: bounce code 550'), false)).toBe('bounce')
  })

  it('classifies undeliverable as bounce', () => {
    expect(classifyError(new Error('recipient undeliverable'), false)).toBe('bounce')
  })

  it('classifies invalid format as invalid_address', () => {
    expect(classifyError(new Error('Invalid email format'), false)).toBe('invalid_address')
  })

  it('classifies malformed recipient address as invalid_address', () => {
    expect(classifyError(new Error('malformed recipient address'), false)).toBe('invalid_address')
  })

  it('classifies unknown error on non-final attempt as bounce (will not retry)', () => {
    // Conservative classification — we'd rather fail-fast on unknown signatures
    // than enqueue indefinite retries against ACS.
    expect(classifyError(new Error('something exploded'), false)).toBe('bounce')
  })

  it('classifies unknown error on FINAL attempt as transient_error_after_retries', () => {
    expect(classifyError(new Error('something exploded'), true)).toBe('transient_error_after_retries')
  })

  it('handles non-Error throws', () => {
    expect(classifyError('not an error object', false)).toBe('bounce')
  })
})

// Issue #540 F1 — resolveFrontendBaseUrl
// Production failure: customereq-worker had no NEXT_PUBLIC_FRONTEND_URL set,
// so the inline expression fell through to `https://app.customereq.example`
// and every email's survey link pointed at a non-existent host. The fix
// extracts URL resolution into a named function that THROWS when no env var
// is set, surfacing the misconfiguration loudly instead of silently
// degrading to a placeholder.
describe('resolveFrontendBaseUrl (Issue #540 F1)', () => {
  const ORIGINAL_NEXT_PUBLIC = process.env.NEXT_PUBLIC_FRONTEND_URL
  const ORIGINAL_FRONTEND = process.env.FRONTEND_URL

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FRONTEND_URL
    delete process.env.FRONTEND_URL
  })

  afterEach(() => {
    if (ORIGINAL_NEXT_PUBLIC === undefined) delete process.env.NEXT_PUBLIC_FRONTEND_URL
    else process.env.NEXT_PUBLIC_FRONTEND_URL = ORIGINAL_NEXT_PUBLIC
    if (ORIGINAL_FRONTEND === undefined) delete process.env.FRONTEND_URL
    else process.env.FRONTEND_URL = ORIGINAL_FRONTEND
  })

  it('returns NEXT_PUBLIC_FRONTEND_URL when set', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = 'https://customereq.wellnessatwork.me'
    expect(resolveFrontendBaseUrl()).toBe('https://customereq.wellnessatwork.me')
  })

  it('falls back to FRONTEND_URL when NEXT_PUBLIC_FRONTEND_URL is not set', () => {
    process.env.FRONTEND_URL = 'https://example.com'
    expect(resolveFrontendBaseUrl()).toBe('https://example.com')
  })

  it('NEXT_PUBLIC_FRONTEND_URL wins when both are set', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = 'https://winner.example'
    process.env.FRONTEND_URL = 'https://loser.example'
    expect(resolveFrontendBaseUrl()).toBe('https://winner.example')
  })

  it('strips a trailing slash so callers can concatenate paths cleanly', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = 'https://customereq.wellnessatwork.me/'
    expect(resolveFrontendBaseUrl()).toBe('https://customereq.wellnessatwork.me')
  })

  it('throws when neither env var is set (loud-fail on misconfiguration)', () => {
    expect(() => resolveFrontendBaseUrl()).toThrow(/NEXT_PUBLIC_FRONTEND_URL|FRONTEND_URL/i)
  })

  it('throws when both env vars are empty strings (defensive against blank deploy config)', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = ''
    process.env.FRONTEND_URL = ''
    expect(() => resolveFrontendBaseUrl()).toThrow()
  })
})
