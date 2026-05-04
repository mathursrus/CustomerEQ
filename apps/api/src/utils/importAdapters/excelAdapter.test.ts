import { describe, it, expect } from 'vitest'
import { parseExcelRows } from './excelAdapter.js'

const NOW = new Date('2026-01-01T00:00:00Z')

describe('Excel adapter — column order independence', () => {
  it('maps columns in standard order', () => {
    const headers = ['user', 'date', 'score', 'verbatim']
    const rows = [['alice@example.com', '2025-11-15', '8', 'Great service']]
    const { rows: out, validationErrors } = parseExcelRows(headers, rows, NOW)
    expect(validationErrors).toHaveLength(0)
    expect(out[0].email).toBe('alice@example.com')
    expect(out[0].score).toBe(8)
    expect(out[0].verbatim).toBe('Great service')
  })

  it('maps columns in reversed order', () => {
    const headers = ['verbatim', 'score', 'date', 'user']
    const rows = [['Great service', '8', '2025-11-15', 'alice@example.com']]
    const { rows: out } = parseExcelRows(headers, rows, NOW)
    expect(out[0].email).toBe('alice@example.com')
    expect(out[0].score).toBe(8)
    expect(out[0].verbatim).toBe('Great service')
  })

  it('maps columns in shuffled order', () => {
    const headers = ['score', 'user', 'verbatim', 'date']
    const rows = [['9', 'bob@example.com', 'Excellent', '2025-10-01']]
    const { rows: out } = parseExcelRows(headers, rows, NOW)
    expect(out[0].email).toBe('bob@example.com')
    expect(out[0].score).toBe(9)
  })
})

describe('Excel adapter — case-insensitive header matching', () => {
  it('matches "Email" (capitalised)', () => {
    const { rows: out } = parseExcelRows(['Email', 'Score'], [['x@example.com', '7']], NOW)
    expect(out[0].email).toBe('x@example.com')
  })

  it('matches "EMAIL" (uppercase)', () => {
    const { rows: out } = parseExcelRows(['EMAIL', 'SCORE'], [['x@example.com', '7']], NOW)
    expect(out[0].email).toBe('x@example.com')
  })

  it('matches "email address" variant (spaces treated as underscores)', () => {
    const { rows: out } = parseExcelRows(['email address', 'Score'], [['x@example.com', '7']], NOW)
    expect(out[0].email).toBe('x@example.com')
  })

  it('matches "respondent_email" variant', () => {
    const { rows: out } = parseExcelRows(['respondent_email', 'score'], [['x@example.com', '5']], NOW)
    expect(out[0].email).toBe('x@example.com')
  })

  it('matches "NPS" as score variant', () => {
    const { rows: out } = parseExcelRows(['user', 'NPS'], [['x@example.com', '8']], NOW)
    expect(out[0].score).toBe(8)
  })

  it('matches "Rating" as score variant', () => {
    const { rows: out } = parseExcelRows(['user', 'Rating'], [['x@example.com', '4']], NOW)
    expect(out[0].score).toBe(8) // 1-5 → 0-10: 4 * 2 = 8
  })

  it('matches "Comment" as verbatim variant', () => {
    const { rows: out } = parseExcelRows(['user', 'Comment'], [['x@example.com', 'Nice']], NOW)
    expect(out[0].verbatim).toBe('Nice')
  })

  it('matches "Feedback" as verbatim variant', () => {
    const { rows: out } = parseExcelRows(['user', 'Feedback'], [['x@example.com', 'Solid']], NOW)
    expect(out[0].verbatim).toBe('Solid')
  })

  it('matches "Response Date" (spaces) as date variant', () => {
    const { rows: out } = parseExcelRows(['user', 'Response Date'], [['x@example.com', '2025-06-01']], NOW)
    expect(out[0].completedAt.getFullYear()).toBe(2025)
  })
})

describe('Excel adapter — score auto-normalisation', () => {
  it('passes through 0-10 scores unchanged', () => {
    const { rows: out } = parseExcelRows(['user', 'score'], [['x@example.com', '9']], NOW)
    expect(out[0].score).toBe(9)
  })

  it('normalises 1-5 CSAT scale (×2)', () => {
    const { rows: out } = parseExcelRows(['user', 'score'], [['x@example.com', '4']], NOW)
    expect(out[0].score).toBe(8)
  })

  it('normalises 1-7 CES scale (×1.43)', () => {
    const { rows: out } = parseExcelRows(['user', 'score'], [['x@example.com', '7']], NOW)
    expect(out[0].score).toBeCloseTo(10, 0)
  })

  it('returns null for non-numeric score', () => {
    const { rows: out } = parseExcelRows(['user', 'score'], [['x@example.com', 'n/a']], NOW)
    expect(out[0].score).toBeNull()
  })

  it('returns null for empty score', () => {
    const { rows: out } = parseExcelRows(['user', 'score'], [['x@example.com', '']], NOW)
    expect(out[0].score).toBeNull()
  })
})

describe('Excel adapter — missing optional columns', () => {
  it('defaults channel to "link" when absent', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].channel).toBe('link')
  })

  it('defaults completedAt to import date when date column absent', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].completedAt).toBe(NOW)
  })

  it('returns null verbatim when verbatim column absent', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].verbatim).toBeNull()
  })

  it('returns null score when score column absent', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].score).toBeNull()
  })

  it('returns null externalId when external_id column absent', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].externalId).toBeNull()
  })
})

describe('Excel adapter — unknown columns forwarded to rawAnswers', () => {
  it('stores unknown columns in rawAnswers under original header name', () => {
    const headers = ['user', 'score', 'product_category', 'region']
    const rows = [['x@example.com', '8', 'SaaS', 'EMEA']]
    const { rows: out } = parseExcelRows(headers, rows, NOW)
    expect(out[0].rawAnswers['product_category']).toBe('SaaS')
    expect(out[0].rawAnswers['region']).toBe('EMEA')
  })

  it('stores program/product column in rawAnswers', () => {
    const headers = ['user', 'score', 'program']
    const rows = [['x@example.com', '7', 'Loyalty Gold']]
    const { rows: out } = parseExcelRows(headers, rows, NOW)
    expect(out[0].rawAnswers['program']).toBe('Loyalty Gold')
  })

  it('does not include recognised mapped columns in rawAnswers', () => {
    const headers = ['user', 'score', 'verbatim']
    const rows = [['x@example.com', '8', 'Nice']]
    const { rows: out } = parseExcelRows(headers, rows, NOW)
    expect(out[0].rawAnswers['user']).toBeUndefined()
    expect(out[0].rawAnswers['score']).toBeUndefined()
    expect(out[0].rawAnswers['verbatim']).toBeUndefined()
  })
})

describe('Excel adapter — validation errors', () => {
  it('returns validation error when no user/email column present', () => {
    const { validationErrors } = parseExcelRows(['score', 'verbatim'], [['8', 'Nice']], NOW)
    expect(validationErrors).toContain(expect.stringContaining('email'))
  })

  it('returns empty rows with validation error on missing email column', () => {
    const { rows, validationErrors } = parseExcelRows(['score'], [['8']], NOW)
    expect(rows).toHaveLength(0)
    expect(validationErrors.length).toBeGreaterThan(0)
  })

  it('returns empty rows for empty input', () => {
    const { rows } = parseExcelRows([], [], NOW)
    expect(rows).toHaveLength(0)
  })
})

describe('Excel adapter — sourceType', () => {
  it('sets sourceType to "excel" on all rows', () => {
    const { rows: out } = parseExcelRows(['user'], [['x@example.com']], NOW)
    expect(out[0].sourceType).toBe('excel')
  })
})
