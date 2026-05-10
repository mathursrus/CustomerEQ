export type ConsentTokenKind = 'privacy' | 'terms'

export interface ConsentToken {
  kind: ConsentTokenKind
  customLabel: string | null
  raw: string
  index: number
  length: number
}

export type ConsentTextSegment =
  | { type: 'text'; text: string }
  | { type: 'token'; token: ConsentToken }

export interface ConsentTextRenderOptions {
  privacyPolicyUrl?: string | null
  termsUrl?: string | null
  rel?: string
  target?: string
  className?: string
  // When the URL for a token is missing, render the anchor without an href
  // (so it isn't navigable) and apply this class instead of `className`.
  // Lets the admin preview show a "this link won't resolve" affordance
  // without making the markup look like a working link.
  brokenClassName?: string
}

export interface ValidationSuccess {
  ok: true
  value: string
}
export interface ValidationFailure {
  ok: false
  errors: Array<{ message: string; path?: string }>
}
export type ValidationResult = ValidationSuccess | ValidationFailure
