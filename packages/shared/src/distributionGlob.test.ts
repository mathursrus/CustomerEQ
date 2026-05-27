import { describe, expect, it } from 'vitest'
import { globToSqlLike } from './distributionGlob.js'

describe('globToSqlLike', () => {
  it.each([
    // Wildcards translate to LIKE wildcards
    { input: '*@artistos.com', expect: '%@artistos.com' },
    { input: 'q2-*',           expect: 'q2-%' },
    { input: 'q?',             expect: 'q_' },
    { input: 'a*b?c',          expect: 'a%b_c' },
    { input: '*',              expect: '%' },
    { input: '',               expect: '' },

    // Literal % and _ must be escaped so they don't gain LIKE-wildcard meaning
    { input: '100%off',        expect: '100\\%off' },
    { input: 'foo_bar',        expect: 'foo\\_bar' },
    { input: '100% off the _',  expect: '100\\% off the \\_' },

    // Literal backslash must be doubled
    { input: '\\foo',          expect: '\\\\foo' },
    { input: 'a\\b',           expect: 'a\\\\b' },

    // Mixed
    { input: '*100%*',         expect: '%100\\%%' },
    { input: '?\\_?',          expect: '_\\\\\\__' },
  ])('translates $input → $expect', ({ input, expect: expected }) => {
    expect(globToSqlLike(input)).toBe(expected)
  })

  it('preserves non-special chars verbatim', () => {
    expect(globToSqlLike('Hello World 123!@#')).toBe('Hello World 123!@#')
  })
})
