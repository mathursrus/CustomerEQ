// Default consent disclosure text seeded into Brand.consentTextDefault on
// lazy-upsert (RFC §4.1, R21). Contains the {{privacy}} token so an
// EXPLICIT-mode brand satisfies the "consent text must contain {{privacy}}"
// cross-field check at first save without further admin action. Slice 4's UI
// presents this as the editable starting text.
export const DEFAULT_CONSENT_TEXT =
  'By submitting this response, you agree we may use your feedback to improve our products and follow up if needed. See our {{privacy}} for details.'
