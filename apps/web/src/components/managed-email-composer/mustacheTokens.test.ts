import { describe, it, expect } from 'vitest'

import { MUSTACHE_TOKENS, isMustacheTokenId } from './mustacheTokens'

describe('mustacheTokens palette', () => {
  it('lists every token the backend renderTemplate.ts substitutes', () => {
    // Backend's substitution set per packages/shared/src/email/renderTemplate.ts.
    // Whenever a token is added/removed there, this test should be updated in
    // the same commit — keeping the two halves of the contract in lockstep.
    const ids = MUSTACHE_TOKENS.map((t) => t.id)
    expect(ids).toEqual([
      'survey_link',
      'first_name',
      'last_name',
      'brand_name',
      'sender_name',
      'survey_title',
    ])
  })

  it('marks survey_link as required (validation gate cares)', () => {
    const surveyLink = MUSTACHE_TOKENS.find((t) => t.id === 'survey_link')
    expect(surveyLink?.required).toBe(true)
  })

  it('does not mark any non-survey_link token as required', () => {
    const required = MUSTACHE_TOKENS.filter((t) => t.required)
    expect(required).toHaveLength(1)
    expect(required[0]?.id).toBe('survey_link')
  })

  it('isMustacheTokenId recognizes valid tokens', () => {
    expect(isMustacheTokenId('survey_link')).toBe(true)
    expect(isMustacheTokenId('first_name')).toBe(true)
  })

  it('isMustacheTokenId rejects unknown tokens', () => {
    expect(isMustacheTokenId('unknown_token')).toBe(false)
    expect(isMustacheTokenId('')).toBe(false)
    // SQL-injection-shaped — defense-in-depth, the chip serializer never
    // touches this codepath for unknown ids but if it did the rejection
    // here would prevent a {{; DROP TABLE; --}} from surviving.
    expect(isMustacheTokenId('survey_link; DROP TABLE')).toBe(false)
  })
})
