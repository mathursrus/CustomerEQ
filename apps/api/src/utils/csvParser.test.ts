import { describe, it, expect } from 'vitest'
import { parseCsv, parseCsvWithHeaders, validateCsvHeaders } from './csvParser.js'

describe('parseCsv', () => {
  it('parses a simple single-row CSV', () => {
    const result = parseCsv('email,score\nfoo@example.com,9')
    expect(result).toEqual([['email', 'score'], ['foo@example.com', '9']])
  })

  it('parses CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(result).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('handles quoted fields with commas', () => {
    const result = parseCsv('email,verbatim\nfoo@example.com,"Good, very good"')
    expect(result[1][1]).toBe('Good, very good')
  })

  it('handles quoted fields with embedded newlines', () => {
    const csv = 'email,verbatim\nfoo@example.com,"Line one\nLine two"'
    const result = parseCsv(csv)
    expect(result[1][1]).toBe('Line one\nLine two')
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    const result = parseCsv('email,verbatim\nfoo@example.com,"He said ""great"""')
    expect(result[1][1]).toBe('He said "great"')
  })

  it('skips blank rows', () => {
    const result = parseCsv('a,b\n\n1,2\n\n')
    expect(result).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseCsvWithHeaders', () => {
  it('returns headers and row objects', () => {
    const csv = 'email,score,verbatim\nfoo@example.com,8,Great service\nbar@example.com,5,OK'
    const { headers, rows } = parseCsvWithHeaders(csv)
    expect(headers).toEqual(['email', 'score', 'verbatim'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ email: 'foo@example.com', score: '8', verbatim: 'Great service' })
    expect(rows[1]).toEqual({ email: 'bar@example.com', score: '5', verbatim: 'OK' })
  })

  it('normalises headers to lowercase', () => {
    const csv = 'Email,Score\nfoo@example.com,9'
    const { headers } = parseCsvWithHeaders(csv)
    expect(headers).toEqual(['email', 'score'])
  })

  it('returns empty arrays for empty CSV', () => {
    const { headers, rows } = parseCsvWithHeaders('')
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })

  it('handles missing trailing columns gracefully', () => {
    const csv = 'email,score,verbatim\nfoo@example.com,9'
    const { rows } = parseCsvWithHeaders(csv)
    expect(rows[0]['verbatim']).toBe('')
  })
})

describe('validateCsvHeaders', () => {
  it('returns empty array when required columns present', () => {
    expect(validateCsvHeaders(['email', 'score'])).toEqual([])
  })

  it('returns missing columns', () => {
    expect(validateCsvHeaders(['score', 'verbatim'])).toEqual(['email'])
  })

  it('is case-sensitive (headers should already be lowercased)', () => {
    expect(validateCsvHeaders(['Email'])).toEqual(['email'])
  })
})
