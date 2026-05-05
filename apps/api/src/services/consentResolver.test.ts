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
    const result = getConsentTextForSurvey(
      { consentTextOverride: null, consentMode: null },
      explicitBrand,
    )
    expect(result.text).toBe(explicitBrand.consentTextDefault)
    expect(result.sourcedFrom).toBe('brand-default')
    expect(result.isSuppressed).toBe(false)
    expect(result.requiresExplicitConsent).toBe(true)
  })

  it('R16 — uses Survey.consentTextOverride when non-empty', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: 'Custom per-survey text.', consentMode: null },
      explicitBrand,
    )
    expect(result.text).toBe('Custom per-survey text.')
    expect(result.sourcedFrom).toBe('survey-override')
    expect(result.isSuppressed).toBe(false)
  })

  it('R17 — empty-string override marks as suppressed and clears text', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: '', consentMode: null },
      explicitBrand,
    )
    expect(result.text).toBeNull()
    expect(result.isSuppressed).toBe(true)
    expect(result.sourcedFrom).toBe('suppressed')
    expect(result.requiresExplicitConsent).toBe(false)
  })

  it('R17 — suppression still passes through privacy/terms URLs (some surfaces still render them)', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: '', consentMode: null },
      explicitBrand,
    )
    expect(result.privacyPolicyUrl).toBe(explicitBrand.privacyPolicyUrl)
    expect(result.termsUrl).toBe(explicitBrand.termsUrl)
  })

  it('IMPLIED_ON_SUBMIT — brand-default text resolves but explicit consent is not required', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: null, consentMode: null },
      impliedBrand,
    )
    expect(result.text).toBe(impliedBrand.consentTextDefault)
    expect(result.requiresExplicitConsent).toBe(false)
  })

  it('returns sourcedFrom=none when no text is configured at any level', () => {
    const result = getConsentTextForSurvey(
      { consentTextOverride: null, consentMode: null },
      unconfiguredBrand,
    )
    expect(result.text).toBeNull()
    expect(result.sourcedFrom).toBe('none')
    expect(result.isSuppressed).toBe(false)
    expect(result.requiresExplicitConsent).toBe(true)
  })

  it('distinguishes empty-string override (suppressed) from null override (fallback)', () => {
    // The two states must not collapse — empty string is the R17 attest-and-
    // suppress signal; null means "no per-survey override, use brand default".
    const suppressed = getConsentTextForSurvey(
      { consentTextOverride: '', consentMode: null },
      explicitBrand,
    )
    const fallthrough = getConsentTextForSurvey(
      { consentTextOverride: null, consentMode: null },
      explicitBrand,
    )
    expect(suppressed.isSuppressed).toBe(true)
    expect(fallthrough.isSuppressed).toBe(false)
    expect(suppressed.text).toBeNull()
    expect(fallthrough.text).toBe(explicitBrand.consentTextDefault)
  })

  // Issue #276 — survey-level consentMode override.
  describe('Issue #276 — Survey.consentMode override', () => {
    it('survey IMPLIED_ON_SUBMIT under EXPLICIT brand → explicit consent NOT required', () => {
      const result = getConsentTextForSurvey(
        { consentTextOverride: null, consentMode: 'IMPLIED_ON_SUBMIT' },
        explicitBrand,
      )
      expect(result.requiresExplicitConsent).toBe(false)
      // Text still resolves from brand default — only the mode changes.
      expect(result.text).toBe(explicitBrand.consentTextDefault)
    })

    it('survey EXPLICIT under IMPLIED_ON_SUBMIT brand → explicit consent IS required', () => {
      const result = getConsentTextForSurvey(
        { consentTextOverride: null, consentMode: 'EXPLICIT' },
        impliedBrand,
      )
      expect(result.requiresExplicitConsent).toBe(true)
    })

    it('survey null under EXPLICIT brand → explicit consent required (existing behavior preserved)', () => {
      const result = getConsentTextForSurvey(
        { consentTextOverride: null, consentMode: null },
        explicitBrand,
      )
      expect(result.requiresExplicitConsent).toBe(true)
    })

    it('survey null under IMPLIED_ON_SUBMIT brand → explicit consent NOT required (existing behavior preserved)', () => {
      const result = getConsentTextForSurvey(
        { consentTextOverride: null, consentMode: null },
        impliedBrand,
      )
      expect(result.requiresExplicitConsent).toBe(false)
    })

    it('override applies in survey-override text branch too', () => {
      // Both consentTextOverride and consentMode set — text comes from override,
      // mode resolved from survey-level null-coalesce.
      const result = getConsentTextForSurvey(
        { consentTextOverride: 'Custom text', consentMode: 'IMPLIED_ON_SUBMIT' },
        explicitBrand,
      )
      expect(result.text).toBe('Custom text')
      expect(result.sourcedFrom).toBe('survey-override')
      expect(result.requiresExplicitConsent).toBe(false)
    })

    it('override applies when no text is configured at any level (sourcedFrom=none branch)', () => {
      const result = getConsentTextForSurvey(
        { consentTextOverride: null, consentMode: 'IMPLIED_ON_SUBMIT' },
        unconfiguredBrand,
      )
      expect(result.sourcedFrom).toBe('none')
      expect(result.text).toBeNull()
      expect(result.requiresExplicitConsent).toBe(false)
    })

    it('R17 suppression takes precedence over survey.consentMode (suppressed = no explicit needed regardless)', () => {
      // R17 suppression is its own short-circuit branch — even if a hypothetical
      // caller passed consentMode = 'EXPLICIT', the suppressed path returns
      // requiresExplicitConsent: false because the disclosure UI isn't shown at all.
      const result = getConsentTextForSurvey(
        { consentTextOverride: '', consentMode: 'EXPLICIT' },
        impliedBrand,
      )
      expect(result.isSuppressed).toBe(true)
      expect(result.requiresExplicitConsent).toBe(false)
    })
  })
})
