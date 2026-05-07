import { describe, expect, it } from 'vitest'
import { tokenize, segments } from './parser.js'
import { CONSENT_TOKEN_RE } from './tokens.js'

describe('tokenize', () => {
  it('returns empty array for plain text with no tokens', () => {
    expect(tokenize('No tokens here.')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([])
  })

  it('parses a bare {{privacy}} token with null customLabel', () => {
    const tokens = tokenize('See our {{privacy}} for details.')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toEqual({
      kind: 'privacy',
      customLabel: null,
      raw: '{{privacy}}',
      index: 8,
      length: 11,
    })
  })

  it('parses a bare {{terms}} token with null customLabel', () => {
    const tokens = tokenize('Read {{terms}}.')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.kind).toBe('terms')
    expect(tokens[0]?.customLabel).toBeNull()
  })

  it('parses a labeled token with explicit customLabel', () => {
    const tokens = tokenize('See our {{privacy:"privacy notice"}} below.')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toEqual({
      kind: 'privacy',
      customLabel: 'privacy notice',
      raw: '{{privacy:"privacy notice"}}',
      index: 8,
      length: 28,
    })
  })

  it('parses multiple tokens in one input and reports correct indices', () => {
    const text = 'By submitting, you agree to {{privacy:"Privacy Policy"}} and {{terms}}.'
    const tokens = tokenize(text)
    expect(tokens).toHaveLength(2)
    expect(tokens[0]?.kind).toBe('privacy')
    expect(tokens[0]?.customLabel).toBe('Privacy Policy')
    expect(tokens[1]?.kind).toBe('terms')
    expect(tokens[1]?.customLabel).toBeNull()
    // The terms token should appear after the privacy token in the source.
    expect(tokens[1]!.index).toBeGreaterThan(tokens[0]!.index + tokens[0]!.length)
  })

  it('does not match unknown token kinds', () => {
    expect(tokenize('Read {{unknown}} now.')).toEqual([])
    expect(tokenize('Read {{cookies}} now.')).toEqual([])
  })

  it('does not match invalid label characters from the allowlist', () => {
    // The inner-string allowlist excludes " < > } { — these break out of
    // the regex's character class and cause the whole token to fail.
    expect(tokenize('{{privacy:"<script>"}}')).toEqual([])
    expect(tokenize('{{privacy:"a<b"}}')).toEqual([])
    expect(tokenize('{{privacy:"a>b"}}')).toEqual([])
    expect(tokenize('{{privacy:"a"b"}}')).toEqual([])
    expect(tokenize('{{privacy:"a{b"}}')).toEqual([])
    expect(tokenize('{{privacy:"a}b"}}')).toEqual([])
  })

  it('rejects label longer than 80 characters at parse time', () => {
    const longLabel = 'a'.repeat(81)
    expect(tokenize(`{{privacy:"${longLabel}"}}`)).toEqual([])
  })

  it('accepts label of exactly 80 characters (boundary)', () => {
    const label80 = 'a'.repeat(80)
    const tokens = tokenize(`{{privacy:"${label80}"}}`)
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.customLabel).toBe(label80)
  })

  it('accepts label of exactly 1 character (boundary)', () => {
    const tokens = tokenize('{{privacy:"a"}}')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.customLabel).toBe('a')
  })

  it('returns a fresh, mutable array on each call (no shared state)', () => {
    // Implementations that reuse a global RegExp can leak lastIndex state
    // across calls. tokenize must be safe under repeated invocation.
    const text = '{{privacy}} and {{terms}}'
    expect(tokenize(text)).toHaveLength(2)
    expect(tokenize(text)).toHaveLength(2)
    expect(tokenize(text)).toHaveLength(2)
  })

  it('does not mutate the source-of-truth CONSENT_TOKEN_RE.lastIndex across calls', () => {
    tokenize('{{privacy}}')
    expect(CONSENT_TOKEN_RE.lastIndex).toBe(0)
  })
})

describe('segments', () => {
  it('returns a single text segment for token-free input', () => {
    expect(segments('hello world')).toEqual([
      { type: 'text', text: 'hello world' },
    ])
  })

  it('returns no segments for empty input', () => {
    expect(segments('')).toEqual([])
  })

  it('interleaves text + token + text correctly', () => {
    const result = segments('See our {{privacy}} now.')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: 'text', text: 'See our ' })
    expect(result[1]?.type).toBe('token')
    if (result[1]?.type === 'token') {
      expect(result[1].token.kind).toBe('privacy')
      expect(result[1].token.customLabel).toBeNull()
    }
    expect(result[2]).toEqual({ type: 'text', text: ' now.' })
  })

  it('handles a token at the start of the string with no leading text segment', () => {
    const result = segments('{{privacy}} is our policy.')
    expect(result[0]?.type).toBe('token')
    expect(result[1]).toEqual({ type: 'text', text: ' is our policy.' })
  })

  it('handles a token at the end of the string with no trailing text segment', () => {
    const result = segments('Our policy: {{privacy}}')
    expect(result[0]).toEqual({ type: 'text', text: 'Our policy: ' })
    expect(result[1]?.type).toBe('token')
    expect(result).toHaveLength(2)
  })

  it('handles back-to-back tokens with no text between them', () => {
    const result = segments('{{privacy}}{{terms}}')
    expect(result).toHaveLength(2)
    expect(result[0]?.type).toBe('token')
    expect(result[1]?.type).toBe('token')
  })

  it('preserves the full text reconstruction by concatenating segments', () => {
    const original = 'A {{privacy:"P"}} and {{terms:"T"}} B'
    const reconstructed = segments(original)
      .map((s) => (s.type === 'text' ? s.text : s.token.raw))
      .join('')
    expect(reconstructed).toBe(original)
  })
})
