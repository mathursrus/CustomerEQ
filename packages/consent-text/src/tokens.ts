// Single source of truth for the consent-text token grammar (RFC §3, Issue #277).
// Inner-string allowlist excludes " < > } { and caps length at 1–80 chars; this
// is the regex-level defense that the renderer's HTML-escape relies on for R18
// defense-in-depth.

export const CONSENT_TOKEN_RE = /\{\{(privacy|terms)(?::"([^"<>}{]{1,80})")?\}\}/g

export const TOKEN_KINDS = ['privacy', 'terms'] as const

export const DEFAULT_LABEL_BY_KIND: Readonly<
  Record<(typeof TOKEN_KINDS)[number], string>
> = {
  privacy: 'Privacy Policy',
  terms: 'Terms and Conditions',
}
