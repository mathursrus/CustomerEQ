// Issue #231 PR2 — consent text resolution for survey response forms.
//
// R16: consent text is brand-level by default, with optional per-survey override.
// R17: brands MAY suppress on-form consent UI for surveys whose responders have
//      prior consent (e.g., internal employee NPS), via the empty-string override
//      pattern: `Survey.consentTextOverride === ''`.
//
// The resolution order:
//   1. If Survey.consentTextOverride is the empty string ('') → suppressed.
//      The form does not render a consent checkbox or disclosure block. The
//      submit endpoint still server-stamps consentGivenAt (audit signal).
//      Per R17 the brand admin must have attested in writing during survey
//      setup; the attestation is stored on the Survey row (consent
//      SuppressedAttestedBy / consentSuppressedAttestedAt).
//   2. Else if Survey.consentTextOverride is a non-empty string → use it.
//   3. Else fall back to Brand.consentTextDefault (may itself be null —
//      admin has not populated the brand-default text yet).

export interface SurveyConsentInput {
  consentTextOverride: string | null
  // Issue #276 — null = inherit Brand.consentMode; non-null overrides it for
  // this survey. Resolution at the requiresExplicitConsent decision below.
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT' | null
}

export interface BrandConsentInput {
  consentTextDefault: string | null
  privacyPolicyUrl: string | null
  termsUrl: string | null
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
}

export type ConsentSource = 'survey-override' | 'brand-default' | 'suppressed' | 'none'

export interface ResolvedConsent {
  // The text to render on the form. Null when source is 'suppressed' (R17) or
  // 'none' (admin hasn't configured brand-default yet).
  text: string | null
  // True iff the brand admin attested-and-suppressed for this survey (R17).
  isSuppressed: boolean
  // Where the resolved text came from — for telemetry / debugging.
  sourcedFrom: ConsentSource
  // Whether the submit endpoint should require an explicit consent flag in
  // the request body. EXPLICIT brands require it (unless suppressed); IMPLIED
  // brands rely on disclosure-on-form alone.
  requiresExplicitConsent: boolean
  // Pass-through for the form UI to render alongside the consent text.
  privacyPolicyUrl: string | null
  termsUrl: string | null
}

export function getConsentTextForSurvey(
  survey: SurveyConsentInput,
  brand: BrandConsentInput,
): ResolvedConsent {
  // R17 empty-string override = suppressed. Distinguish from null override
  // (which falls through to brand default).
  if (survey.consentTextOverride === '') {
    return {
      text: null,
      isSuppressed: true,
      sourcedFrom: 'suppressed',
      requiresExplicitConsent: false,
      privacyPolicyUrl: brand.privacyPolicyUrl,
      termsUrl: brand.termsUrl,
    }
  }

  if (survey.consentTextOverride && survey.consentTextOverride.length > 0) {
    return {
      text: survey.consentTextOverride,
      isSuppressed: false,
      sourcedFrom: 'survey-override',
      requiresExplicitConsent: (survey.consentMode ?? brand.consentMode) === 'EXPLICIT',
      privacyPolicyUrl: brand.privacyPolicyUrl,
      termsUrl: brand.termsUrl,
    }
  }

  if (brand.consentTextDefault && brand.consentTextDefault.length > 0) {
    return {
      text: brand.consentTextDefault,
      isSuppressed: false,
      sourcedFrom: 'brand-default',
      requiresExplicitConsent: (survey.consentMode ?? brand.consentMode) === 'EXPLICIT',
      privacyPolicyUrl: brand.privacyPolicyUrl,
      termsUrl: brand.termsUrl,
    }
  }

  // Brand admin hasn't populated default consent text. The submit endpoint
  // treats this as a configuration error (400 BRAND_CONSENT_NOT_CONFIGURED)
  // when consentMode = EXPLICIT; under IMPLIED_ON_SUBMIT the form may proceed
  // but with no disclosure rendered — typically not a desirable state.
  return {
    text: null,
    isSuppressed: false,
    sourcedFrom: 'none',
    requiresExplicitConsent: (survey.consentMode ?? brand.consentMode) === 'EXPLICIT',
    privacyPolicyUrl: brand.privacyPolicyUrl,
    termsUrl: brand.termsUrl,
  }
}
