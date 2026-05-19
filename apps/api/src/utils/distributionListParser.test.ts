import { describe, it, expect } from 'vitest'
import { parsePasteBody, parseCsvBody, bodyHasCsvHeader } from './distributionListParser.js'

describe('bodyHasCsvHeader — CSV-vs-paste routing', () => {
  it('returns true when first cell is a known header alias', () => {
    expect(bodyHasCsvHeader('email,first_name\njohn@x.com,John')).toBe(true)
    expect(bodyHasCsvHeader('Email Address,FNAME\njohn@x.com,John')).toBe(true)
    expect(bodyHasCsvHeader('phone,name\n+15551234,Jane')).toBe(true)
    expect(bodyHasCsvHeader('customer_id,name\nabc,X')).toBe(true)
  })

  it('returns false for a paste of bare emails with trailing commas (#378 walk-through #15)', () => {
    // Regression test for the bug where `looksLikeCsv = firstLine.includes(',') && body.includes('\n')`
    // false-positived on every paste with trailing commas and silently
    // consumed the first row as a fake header, dropping 1 email from the audience.
    expect(bodyHasCsvHeader('user001@x.com,\nuser002@x.com,\nuser003@x.com,')).toBe(false)
    expect(bodyHasCsvHeader('a@b.com,c@d.com\ne@f.com')).toBe(false)
  })

  it('returns false for single-line paste (no newline)', () => {
    expect(bodyHasCsvHeader('email,first_name')).toBe(false)
    expect(bodyHasCsvHeader('a@b.com')).toBe(false)
  })

  it('returns false for empty body', () => {
    expect(bodyHasCsvHeader('')).toBe(false)
    expect(bodyHasCsvHeader('\n\n')).toBe(false)
  })
})

describe('parsePasteBody — separators', () => {
  it('splits on newline', () => {
    const result = parsePasteBody('a@b.com\nc@d.com\ne@f.com', 'EMAIL')
    expect(result.rows.map((r) => r.identifier)).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('splits on comma', () => {
    const result = parsePasteBody('a@b.com, c@d.com, e@f.com', 'EMAIL')
    expect(result.rows).toHaveLength(3)
  })

  it('splits on semicolon', () => {
    const result = parsePasteBody('a@b.com; c@d.com; e@f.com', 'EMAIL')
    expect(result.rows).toHaveLength(3)
  })

  it('handles a mix of separators in one paste', () => {
    const result = parsePasteBody('a@b.com,c@d.com\ne@f.com;g@h.com', 'EMAIL')
    expect(result.rows).toHaveLength(4)
  })

  it('skips blank entries', () => {
    const result = parsePasteBody('a@b.com,,,,\n\n\nc@d.com', 'EMAIL')
    expect(result.rows).toHaveLength(2)
  })
})

describe('parsePasteBody — Brand.memberIdentifierKind tie-breaker', () => {
  it('EMAIL brand: jane@b.com resolves; phone + external_id land in unmatched', () => {
    const result = parsePasteBody('jane@brand.com\n+15551234\nusr_abc', 'EMAIL')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ identifier: 'jane@brand.com', identifierKind: 'email' })
    expect(result.unmatched).toEqual(['+15551234', 'usr_abc'])
  })

  it('PHONE brand: +15551234 resolves; email + external_id land in unmatched', () => {
    const result = parsePasteBody('jane@brand.com\n+15551234\nusr_abc', 'PHONE')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].identifier).toBe('+15551234')
    expect(result.rows[0].identifierKind).toBe('phone')
  })

  it('CUSTOMER_ID brand: usr_abc resolves; email + phone land in unmatched', () => {
    const result = parsePasteBody('jane@brand.com\n+15551234\nusr_abc', 'CUSTOMER_ID')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].identifier).toBe('usr_abc')
    expect(result.rows[0].identifierKind).toBe('external_id')
  })

  it('lowercases email identifiers (canonical case)', () => {
    const result = parsePasteBody('JANE@Brand.COM', 'EMAIL')
    expect(result.rows[0].identifier).toBe('jane@brand.com')
  })

  it('preserves case for non-email identifiers', () => {
    const result = parsePasteBody('Usr_ABC', 'CUSTOMER_ID')
    expect(result.rows[0].identifier).toBe('Usr_ABC')
  })
})

describe('parsePasteBody — Name <email> form', () => {
  it('extracts firstName + lastName from "Jane Mitchell <jane@brand.com>"', () => {
    const result = parsePasteBody('Jane Mitchell <jane@brand.com>', 'EMAIL')
    expect(result.rows[0]).toEqual({
      identifier: 'jane@brand.com',
      identifierKind: 'email',
      firstName: 'Jane',
      lastName: 'Mitchell',
    })
  })

  it('single-token name populates firstName only', () => {
    const result = parsePasteBody('Madonna <m@example.com>', 'EMAIL')
    expect(result.rows[0].firstName).toBe('Madonna')
    expect(result.rows[0].lastName).toBeUndefined()
  })

  it('multi-token name treats final token as lastName, rest as firstName', () => {
    const result = parsePasteBody('Mary Jane Watson <mjw@example.com>', 'EMAIL')
    expect(result.rows[0].firstName).toBe('Mary Jane')
    expect(result.rows[0].lastName).toBe('Watson')
  })

  it('strips surrounding quotes from the display name', () => {
    const result = parsePasteBody('"Jane Mitchell" <jane@brand.com>', 'EMAIL')
    expect(result.rows[0].firstName).toBe('Jane')
    expect(result.rows[0].lastName).toBe('Mitchell')
  })

  it('rejects Name <value> when the value does not match the brand kind', () => {
    const result = parsePasteBody('Jane <not-an-email>', 'EMAIL')
    expect(result.rows).toHaveLength(0)
    expect(result.unmatched).toEqual(['Jane <not-an-email>'])
  })
})

describe('parseCsvBody — header alias detection', () => {
  it('detects "email" header (lowercase)', () => {
    const csv = 'email\njane@brand.com\nbob@brand.com'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].identifier).toBe('jane@brand.com')
  })

  it('detects "Email Address" with case + spaces is NOT a built-in alias — falls back to inference', () => {
    // The spec lists 'email', 'e-mail', 'mail' as the aliases. "Email Address" is not listed.
    // Inference will still pick the column up because every cell looks like an email.
    const csv = 'Email Address\njane@brand.com\nbob@brand.com'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(2)
  })

  it('detects "e-mail" alias', () => {
    const csv = 'e-mail\njane@brand.com'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0].identifier).toBe('jane@brand.com')
  })

  it('detects "phone_number" alias for phone brand', () => {
    const csv = 'phone_number\n+15551234567'
    const result = parseCsvBody({ body: csv, brandKind: 'PHONE' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].identifierKind).toBe('phone')
  })

  it('detects "Customer ID" alias for CUSTOMER_ID brand', () => {
    const csv = 'Customer ID\nusr_abc\nusr_def'
    const result = parseCsvBody({ body: csv, brandKind: 'CUSTOMER_ID' })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].identifier).toBe('usr_abc')
  })
})

describe('parseCsvBody — multi-column tie-breaker', () => {
  it('EMAIL brand wins email column over phone column when both present', () => {
    const csv = 'email,phone\njane@brand.com,+15551234'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0].identifier).toBe('jane@brand.com')
    expect(result.rows[0].identifierKind).toBe('email')
  })

  it('PHONE brand wins phone column over email column when both present', () => {
    const csv = 'email,phone\njane@brand.com,+15551234'
    const result = parseCsvBody({ body: csv, brandKind: 'PHONE' })
    expect(result.rows[0].identifier).toBe('+15551234')
    expect(result.rows[0].identifierKind).toBe('phone')
  })
})

describe('parseCsvBody — explicit name columns', () => {
  it('uses explicit firstName + lastName columns when present', () => {
    const csv = 'email,first_name,last_name\njane@brand.com,Jane,Mitchell'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0]).toEqual({
      identifier: 'jane@brand.com',
      identifierKind: 'email',
      firstName: 'Jane',
      lastName: 'Mitchell',
    })
  })

  it('detects "First Name" / "Last Name" with spaces', () => {
    const csv = 'email,First Name,Last Name\njane@brand.com,Jane,Mitchell'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0].firstName).toBe('Jane')
    expect(result.rows[0].lastName).toBe('Mitchell')
  })
})

describe('parseCsvBody — OQ-S4 explicit-column-empty fallback', () => {
  it('falls back to bracketed name when explicit name columns are empty', () => {
    const csv = 'email,first_name,last_name\n"Carlos <c@example.com>",,'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].identifier).toBe('c@example.com')
    expect(result.rows[0].firstName).toBe('Carlos')
  })

  it('explicit non-empty column wins over bracketed name', () => {
    const csv = 'email,first_name,last_name\n"Carlos <c@example.com>",Jane,Doe'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0].firstName).toBe('Jane')
    expect(result.rows[0].lastName).toBe('Doe')
  })

  it('partial fallback: explicit firstName present, lastName empty, bracket fills lastName only', () => {
    const csv = 'email,first_name,last_name\n"Carlos Rodriguez <c@example.com>",Jane,'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows[0].firstName).toBe('Jane')           // explicit wins
    expect(result.rows[0].lastName).toBe('Rodriguez')       // bracket fills the gap
  })
})

describe('parseCsvBody — no-header / inference path', () => {
  it('infers email column when header is unrecognised', () => {
    const csv = 'Subscriber,Notes\njane@brand.com,VIP\nbob@brand.com,regular'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].identifier).toBe('jane@brand.com')
  })

  it('skips blank rows', () => {
    const csv = 'email\njane@brand.com\n\n\nbob@brand.com\n'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(2)
  })

  it('routes a row with no parseable identifier to unmatched', () => {
    const csv = 'email\nthis is not an email\njane@brand.com'
    const result = parseCsvBody({ body: csv, brandKind: 'EMAIL' })
    expect(result.rows).toHaveLength(1)
    expect(result.unmatched).toHaveLength(1)
  })
})
