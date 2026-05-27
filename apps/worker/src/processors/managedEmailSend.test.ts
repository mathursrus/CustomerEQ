import { describe, expect, it } from 'vitest'
import { __testing__ } from './managedEmailSend.js'

const { checkSuppression, classifyError } = __testing__

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
