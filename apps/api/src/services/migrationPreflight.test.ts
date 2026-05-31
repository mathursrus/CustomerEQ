/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  parseMappingCsv,
  buildFastPathRows,
  validatePreflight,
  type PreflightMember,
} from './migrationPreflight.js'

// Pure, DB-free unit tests for the identifier-migration pre-flight validator
// (R6–R12). The route layer fetches Member rows and passes them in; nothing
// here touches the database. `customerId` on a PreflightMember is the member's
// CURRENT externalId (lowered) — the value the brand's mapping `customer_id`
// column must match against.

function member(customerId: string, email: string | null): PreflightMember {
  return { memberId: `mem_${customerId}`, customerId, email }
}

describe('parseMappingCsv', () => {
  it('parses a well-formed customer_id,new_email CSV into rows (1-based row numbers)', () => {
    const csv = 'customer_id,new_email\ncust_1,a@acme.com\ncust_2,b@acme.com\n'
    const { rows, error } = parseMappingCsv(csv)
    expect(error).toBeUndefined()
    expect(rows).toEqual([
      { row: 1, customerId: 'cust_1', newEmail: 'a@acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ])
  })

  it('tolerates CRLF line endings, surrounding whitespace, and a trailing blank line', () => {
    const csv = 'customer_id,new_email\r\n cust_1 , A@Acme.com \r\ncust_2,b@acme.com\r\n'
    const { rows, error } = parseMappingCsv(csv)
    expect(error).toBeUndefined()
    // values are trimmed; case preserved at parse time (normalized later)
    expect(rows).toEqual([
      { row: 1, customerId: 'cust_1', newEmail: 'A@Acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ])
  })

  it('rejects a CSV missing the required columns (R6: clear message, no rows)', () => {
    const { rows, error } = parseMappingCsv('id,email\ncust_1,a@acme.com\n')
    expect(rows).toEqual([])
    expect(error).toMatch(/customer_id.*new_email/i)
  })

  it('rejects an empty file (R6)', () => {
    const { rows, error } = parseMappingCsv('')
    expect(rows).toEqual([])
    expect(error).toBeTruthy()
  })

  it('accepts a header with only the two required columns regardless of column order', () => {
    const { rows, error } = parseMappingCsv('new_email,customer_id\na@acme.com,cust_1\n')
    expect(error).toBeUndefined()
    expect(rows).toEqual([{ row: 1, customerId: 'cust_1', newEmail: 'a@acme.com' }])
  })
})

describe('buildFastPathRows (R28 fast path — map from existing Member.email)', () => {
  it('builds one row per member using existing email, customerId from externalId', () => {
    const members = [member('cust_1', 'a@acme.com'), member('cust_2', 'b@acme.com')]
    expect(buildFastPathRows(members)).toEqual([
      { row: 1, customerId: 'cust_1', newEmail: 'a@acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ])
  })

  it('emits a blank newEmail for members with no email on file (so preflight flags them)', () => {
    const members = [member('cust_1', 'a@acme.com'), member('cust_2', null)]
    const rows = buildFastPathRows(members)
    expect(rows[1]).toEqual({ row: 2, customerId: 'cust_2', newEmail: '' })
  })
})

describe('validatePreflight', () => {
  it('R7 — reports a clean result when every member is mapped with a unique valid email', () => {
    const members = [member('cust_1', null), member('cust_2', null)]
    const rows = [
      { row: 1, customerId: 'cust_1', newEmail: 'a@acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({
      totalRows: 2,
      membersMatched: 2,
      unmappedMembers: 0,
      collisions: 0,
      invalidShape: 0,
    })
    expect(result.rowIssues).toEqual([])
  })

  it('R8/R11 — flags a member with no row as unmapped and blocks (ok=false)', () => {
    const members = [member('cust_1', null), member('cust_2', null), member('cust_3', null)]
    const rows = [
      { row: 1, customerId: 'cust_1', newEmail: 'a@acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(false)
    expect(result.counts.unmappedMembers).toBe(1)
    expect(result.rowIssues).toContainEqual(
      expect.objectContaining({ customerId: 'cust_3', reason: 'unmapped' }),
    )
  })

  it('R9 — flags two rows whose new_email normalizes to the same value as a collision (both rows)', () => {
    const members = [member('cust_1', null), member('cust_2', null)]
    const rows = [
      { row: 1, customerId: 'cust_1', newEmail: 'Jane@Acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: ' jane@acme.com ' },
    ]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(false)
    expect(result.counts.collisions).toBe(2)
    const collisionRows = result.rowIssues.filter((i) => i.reason === 'collision').map((i) => i.row)
    expect(collisionRows).toEqual(expect.arrayContaining([1, 2]))
  })

  it('R10 — flags a new_email that is not a valid email shape', () => {
    const members = [member('cust_1', null), member('cust_2', null)]
    const rows = [
      { row: 1, customerId: 'cust_1', newEmail: 'not-an-email' },
      { row: 2, customerId: 'cust_2', newEmail: 'b@acme.com' },
    ]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(false)
    expect(result.counts.invalidShape).toBe(1)
    expect(result.rowIssues).toContainEqual(
      expect.objectContaining({ row: 1, reason: 'invalid_shape' }),
    )
  })

  it('R12 — every row issue carries a plain-language detail string', () => {
    const members = [member('cust_1', null), member('cust_2', null)]
    const rows = [{ row: 1, customerId: 'cust_1', newEmail: 'bad' }]
    const result = validatePreflight(members, rows)
    for (const issue of result.rowIssues) {
      expect(typeof issue.detail).toBe('string')
      expect(issue.detail.length).toBeGreaterThan(0)
    }
  })

  it('matches mapping customer_id to member externalId case-insensitively and trims', () => {
    const members = [member('cust_1', null)]
    const rows = [{ row: 1, customerId: ' CUST_1 ', newEmail: 'a@acme.com' }]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(true)
    expect(result.counts.membersMatched).toBe(1)
    expect(result.counts.unmappedMembers).toBe(0)
  })

  it('counts multiple independent issue types together (R7 aggregate)', () => {
    const members = [member('cust_1', null), member('cust_2', null), member('cust_3', null)]
    const rows = [
      { row: 1, customerId: 'cust_1', newEmail: 'dup@acme.com' },
      { row: 2, customerId: 'cust_2', newEmail: 'dup@acme.com' }, // collision
      // cust_3 unmapped; also an invalid row below
      { row: 3, customerId: 'cust_3', newEmail: 'invalid' }, // invalid_shape (cust_3 IS mapped)
    ]
    const result = validatePreflight(members, rows)
    expect(result.ok).toBe(false)
    expect(result.counts.collisions).toBe(2)
    expect(result.counts.invalidShape).toBe(1)
    expect(result.counts.unmappedMembers).toBe(0) // cust_3 has a row (just an invalid email)
  })
})
