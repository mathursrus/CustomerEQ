import { describe, expect, it } from 'vitest'
import {
  zConsentText,
  validateConsentText,
  hasPrivacyToken,
  isConsentTextValid,
} from './validator.js'

describe('zConsentText', () => {
  it('accepts plain text with no tokens', () => {
    expect(zConsentText.safeParse('Hello there.').success).toBe(true)
  })

  it('accepts the empty string', () => {
    // Empty consent text is permitted at the brand-default level (admins seed
    // a default but may also clear it). The cross-field gate in EXPLICIT mode
    // is implemented at the API route layer, not the schema.
    expect(zConsentText.safeParse('').success).toBe(true)
  })

  it('accepts text with a bare {{privacy}} token', () => {
    expect(zConsentText.safeParse('See our {{privacy}}.').success).toBe(true)
  })

  it('accepts text with a labeled {{privacy:"…"}} token', () => {
    expect(zConsentText.safeParse('See our {{privacy:"my privacy notice"}}.').success).toBe(true)
  })

  it('accepts text mixing both kinds of tokens', () => {
    const text = 'By submitting, you agree to {{privacy}} and {{terms:"T&Cs"}} apply.'
    // Note: '&' is allowed in the inner string (only " < > } { are excluded).
    expect(zConsentText.safeParse(text).success).toBe(true)
  })

  it('rejects non-string input', () => {
    expect(zConsentText.safeParse(123).success).toBe(false)
    expect(zConsentText.safeParse(null).success).toBe(false)
    expect(zConsentText.safeParse(undefined).success).toBe(false)
    expect(zConsentText.safeParse({}).success).toBe(false)
  })

  it('rejects text containing a malformed label that escapes the allowlist', () => {
    // {{privacy:"<script>alert(1)</script>"}} should fail — the label contains
    // < and > which are excluded by the inner-string character class.
    expect(zConsentText.safeParse('See {{privacy:"<script>"}} bad.').success).toBe(false)
  })

  it('rejects text whose label is exactly one character over the cap', () => {
    const long = 'a'.repeat(81)
    expect(zConsentText.safeParse(`{{privacy:"${long}"}}`).success).toBe(false)
  })

  it('accepts a text whose label is exactly at the cap', () => {
    const at = 'a'.repeat(80)
    expect(zConsentText.safeParse(`{{privacy:"${at}"}}`).success).toBe(true)
  })

  it('rejects an unknown token kind embedded in otherwise-valid syntax', () => {
    expect(zConsentText.safeParse('Read {{cookies:"Cookies"}}.').success).toBe(false)
  })

  it('enforces a maximum total length of 500 chars (per spec L148)', () => {
    // Spec F8 says consentTextDefault is 0–500 chars.
    expect(zConsentText.safeParse('a'.repeat(500)).success).toBe(true)
    expect(zConsentText.safeParse('a'.repeat(501)).success).toBe(false)
  })
})

describe('validateConsentText', () => {
  it('returns ok=true with the parsed value on accept', () => {
    const result = validateConsentText('hello {{privacy}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('hello {{privacy}}')
    }
  })

  it('returns ok=false with errors on reject', () => {
    const result = validateConsentText('bad {{privacy:"<x>"}}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.message).toBeTruthy()
    }
  })

  it('reports a non-string input as a type error', () => {
    const result = validateConsentText(123 as unknown)
    expect(result.ok).toBe(false)
  })
})

describe('hasPrivacyToken', () => {
  it('returns true when a bare {{privacy}} token is present', () => {
    expect(hasPrivacyToken('See our {{privacy}}.')).toBe(true)
  })

  it('returns true when a labeled {{privacy:"…"}} token is present', () => {
    expect(hasPrivacyToken('See our {{privacy:"my notice"}}.')).toBe(true)
  })

  it('returns false when only a {{terms}} token is present', () => {
    expect(hasPrivacyToken('See our {{terms}}.')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(hasPrivacyToken('Plain text only.')).toBe(false)
  })

  it('returns false for the empty string', () => {
    expect(hasPrivacyToken('')).toBe(false)
  })

  it('returns false for a malformed privacy token (allowlist failure)', () => {
    // The token contains an unsafe char in the label, so the regex does not
    // match and the function returns false — the gate fails, and the API
    // route layer should reject the save.
    expect(hasPrivacyToken('{{privacy:"<bad>"}}')).toBe(false)
  })

  it('safe under repeated invocation (no shared regex state)', () => {
    const text = '{{privacy}}'
    expect(hasPrivacyToken(text)).toBe(true)
    expect(hasPrivacyToken(text)).toBe(true)
    expect(hasPrivacyToken(text)).toBe(true)
  })
})

describe('isConsentTextValid', () => {
  it('narrows the input type to string when valid', () => {
    const v: unknown = 'hello'
    if (isConsentTextValid(v)) {
      // TypeScript narrowing — this line should compile because v is now string.
      expect(v.toUpperCase()).toBe('HELLO')
    } else {
      throw new Error('expected isConsentTextValid to narrow to true')
    }
  })

  it('returns false for invalid input', () => {
    expect(isConsentTextValid(123)).toBe(false)
    expect(isConsentTextValid('a'.repeat(501))).toBe(false)
  })
})
