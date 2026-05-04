/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { getConsentTextForSurvey } from './consentResolver.js'

const explicitBrand = {
  consentTextDefault: 'By submitting you agree to our privacy policy and terms.',
  privacyPolicyUrl: 'https://acme.example.com/privacy',
  termsUrl: 'https://acme.example.com/terms',
  consentMode: 'EXPLICIT' as const,
}

const impliedBrand = {
  ...explicitBrand,
  consentMode: 'IMPLIED_ON_SUBMIT' as const,
}

const unconfiguredBrand = {
  consentTextDefault: null,
  privacyPolicyUrl: null,
  termsUrl: null,
  consentMode: 'EXPLICIT' as const,
}

describe('getConsentTextForSurvey', () => {
  it('R16 — falls back to Brand.consentTextDefault when survey override is null', () => {
    const result = getConsentTextForSurvey({ consentTextOverride: null }, explicitBrand)
    expect(result.text).toBe(explicitBrand.consentTextDefault)
    expect(result.sourcedFrom).toBe('brand-default')
    expect(result.isSuppressed).toBe(false)
    expect(result.requiresExplicitConsent).toBe(true)
  })

  it('R16 — uses Survey.consentTextOverride when non-empty', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: 'Custom per-survey text.' },
      explicitBrand,
    )
    expect(result.text).toBe('Custom per-survey text.')
    expect(result.sourcedFrom).toBe('survey-override')
    expect(result.isSuppressed).toBe(false)
  })

  it('R17 — empty-string override marks as suppressed and clears text', () => {
    const result = getConsentTextForSurvey({ consentTextOverride: '' }, explicitBrand)
    expect(result.text).toBeNull()
    expect(result.isSuppressed).toBe(true)
    expect(result.sourcedFrom).toBe('suppressed')
    expect(result.requiresExplicitConsent).toBe(false)
  })

  it('R17 — suppression still passes through privacy/terms URLs (some surfaces still render them)', () => {
    const result = getConsentTextForSurvey({ consentTextOverride: '' }, explicitBrand)
    expect(result.privacyPolicyUrl).toBe(explicitBrand.privacyPolicyUrl)
    expect(result.termsUrl).toBe(explicitBrand.termsUrl)
  })

  it('IMPLIED_ON_SUBMIT — brand-default text resolves but explicit consent is not required', () => {
    const result = getConsentTextForSurvey({ consentTextOverride: null }, impliedBrand)
    expect(result.text).toBe(impliedBrand.consentTextDefault)
    expect(result.requiresExplicitConsent).toBe(false)
  })

  it('returns sourcedFrom=none when no text is configured at any level', () => {
    const result = getConsentTextForSurvey({ consentTextOverride: null }, unconfiguredBrand)
    expect(result.text).toBeNull()
    expect(result.sourcedFrom).toBe('none')
    expect(result.isSuppressed).toBe(false)
    expect(result.requiresExplicitConsent).toBe(true)
  })

  it('distinguishes empty-string override (suppressed) from null override (fallback)', () => {
    // The two states must not collapse — empty string is the R17 attest-and-
    // suppress signal; null means "no per-survey override, use brand default".
    const suppressed = getConsentTextForSurvey({ consentTextOverride: '' }, explicitBrand)
    const fallthrough = getConsentTextForSurvey({ consentTextOverride: null }, explicitBrand)
    expect(suppressed.isSuppressed).toBe(true)
    expect(fallthrough.isSuppressed).toBe(false)
    expect(suppressed.text).toBeNull()
    expect(fallthrough.text).toBe(explicitBrand.consentTextDefault)
  })
})
