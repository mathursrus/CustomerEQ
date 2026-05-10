import { z } from 'zod'
import { CONSENT_TOKEN_RE } from './tokens.js'
import type { ValidationResult } from './types.js'

// Spec L148 (F8): consentTextDefault is 0–500 chars.
const MAX_LEN = 500

// After stripping every well-formed token, any residual `{{` or `}}` proves
// the input contained a malformed token (unknown kind, inner string outside
// the allowlist, or inner string longer than 80 chars).
function hasMalformedToken(text: string): boolean {
  const stripped = text.replace(CONSENT_TOKEN_RE, '')
  return /\{\{|\}\}/.test(stripped)
}

export const zConsentText = z
  .string()
  .max(MAX_LEN, `consent text must be at most ${MAX_LEN} characters`)
  .refine((s) => !hasMalformedToken(s), {
    message:
      'consent text contains a malformed {{privacy}} / {{terms}} token (unknown kind, label outside allowlist, or label longer than 80 chars)',
  })

export function validateConsentText(text: unknown): ValidationResult {
  const parsed = zConsentText.safeParse(text)
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => ({
      message: i.message,
      path: i.path.length > 0 ? i.path.join('.') : undefined,
    })),
  }
}

export function hasPrivacyToken(text: string): boolean {
  if (text.length === 0) return false
  // Non-global regex — .test() is stateless; safe under repeated invocation.
  return /\{\{privacy(?::"[^"<>}{]{1,80}")?\}\}/.test(text)
}

export function isConsentTextValid(text: unknown): text is string {
  return zConsentText.safeParse(text).success
}
