// Default consent disclosure text seeded into Brand.consentTextDefault on
// lazy-upsert (RFC §4.1, R21). Contains the {{privacy}} token so an
// EXPLICIT-mode brand satisfies the "consent text must contain {{privacy}}"
// cross-field check at first save without further admin action. Slice 4's UI
// presents this as the editable starting text.
export const DEFAULT_CONSENT_TEXT =
  'I agree to be contacted and to the {{privacy}} policy.'
