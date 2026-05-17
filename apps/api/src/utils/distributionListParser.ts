// Issue #378 — Custom List identifier parser.
//
// Parses both paste-body and CSV-upload shapes per spec R6:
//
// PASTE shape:
//   - Up to 10,000 entries per request (caller enforces).
//   - Entries separated by newline, comma, or semicolon — any mix.
//   - Each entry is either a bare identifier (e.g., 'jane@brand.com',
//     '+15551234', 'usr_abc') or RFC-822-style 'Display Name <value>'.
//   - The brand's `memberIdentifierKind` is the tie-breaker for ambiguous
//     shapes (e.g., '12345' could be phone or external_id).
//
// CSV upload shape:
//   - text/csv raw body (caller parses via parseCsvRaw).
//   - Header row inspected for aliases:
//       email:       'email' / 'e-mail' / 'mail'
//       phone:       'phone' / 'phone_number' / 'phonenumber' / 'mobile'
//       external_id: 'external_id' / 'customer_id' / 'customer id'
//       member_id:   'member_id' / 'memberId' / 'member id'
//       firstName:   'first_name' / 'firstname' / 'first name' / 'given name' / 'given_name'
//       lastName:    'last_name' / 'lastname' / 'last name' / 'surname' / 'family name' / 'family_name'
//   - When the header is absent or unrecognised, per-cell format inference
//     is used.
//   - `Brand.memberIdentifierKind` wins the tie when multiple identifier-
//     shaped columns are present.
//   - Multi-column CSVs with explicit firstName / lastName columns are
//     accepted; explicit columns win over bracketed-name form except when
//     the explicit column is empty (OQ-S4 resolved per R3-28).

import type { MemberIdentifierKind } from '@prisma/client'
import { parseCsvRaw } from './csvParser.js'

export type IdentifierKind = 'email' | 'phone' | 'external_id' | 'member_id'

export interface ParsedRow {
  /** Identifier of record (already trimmed; lowercased only if kind === 'email'). */
  identifier: string
  identifierKind: IdentifierKind
  firstName?: string
  lastName?: string
}

export interface ParsedListResult {
  rows: ParsedRow[]
  /** Raw entries that did not parse to an identifier matching the brand's kind. */
  unmatched: string[]
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const E164_RE = /^\+?[1-9]\d{6,14}$/
const NAME_EMAIL_RE = /^(.*)\s*<\s*([^<>\s]+)\s*>\s*$/

const HEADER_ALIASES: Readonly<Record<string, IdentifierKind | 'firstName' | 'lastName'>> = {
  // identifier kinds
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  phone: 'phone',
  'phone number': 'phone',
  phonenumber: 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  external_id: 'external_id',
  externalid: 'external_id',
  customer_id: 'external_id',
  'customer id': 'external_id',
  customerid: 'external_id',
  member_id: 'member_id',
  memberid: 'member_id',
  'member id': 'member_id',
  // name columns
  first_name: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  given_name: 'firstName',
  'given name': 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  surname: 'lastName',
  family_name: 'lastName',
  'family name': 'lastName',
}

const BRAND_KIND_TO_IDENTIFIER_KIND: Readonly<Record<MemberIdentifierKind, IdentifierKind>> = {
  EMAIL: 'email',
  PHONE: 'phone',
  CUSTOMER_ID: 'external_id',
}

/**
 * Parses a raw paste body. Splits on newline / comma / semicolon, trims each
 * entry, attempts to match the brand's `memberIdentifierKind`. Entries that
 * don't match the brand's primary kind land in `unmatched`. The `Name <email>`
 * form is supported for EMAIL-keyed brands.
 */
export function parsePasteBody(body: string, brandKind: MemberIdentifierKind): ParsedListResult {
  const expectedKind = BRAND_KIND_TO_IDENTIFIER_KIND[brandKind]
  const rows: ParsedRow[] = []
  const unmatched: string[] = []
  const entries = body
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0)

  for (const entry of entries) {
    const parsed = parsePasteEntry(entry, expectedKind)
    if (parsed) {
      rows.push(parsed)
    } else {
      unmatched.push(entry)
    }
  }

  return { rows, unmatched }
}

function parsePasteEntry(entry: string, expectedKind: IdentifierKind): ParsedRow | null {
  // RFC-822 'Name <value>' form. Only meaningful when expected kind = email
  // (other kinds don't sit naturally inside angle brackets in real mail-list
  // pastes), but we accept the shape regardless of expected kind and validate
  // the inner identifier against the expected kind.
  const nameEmailMatch = entry.match(NAME_EMAIL_RE)
  if (nameEmailMatch) {
    const namePart = nameEmailMatch[1].trim()
    const valuePart = nameEmailMatch[2].trim()
    const inferred = inferIdentifierKind(valuePart)
    if (inferred === expectedKind) {
      const { firstName, lastName } = splitDisplayName(namePart)
      const row: ParsedRow = {
        identifier: normaliseIdentifier(valuePart, expectedKind),
        identifierKind: expectedKind,
      }
      if (firstName !== undefined) row.firstName = firstName
      if (lastName !== undefined) row.lastName = lastName
      return row
    }
    return null
  }

  // Bare value — infer kind from the shape, then accept only if it matches
  // the brand's expected kind.
  const inferred = inferIdentifierKind(entry)
  if (inferred === expectedKind) {
    return { identifier: normaliseIdentifier(entry, expectedKind), identifierKind: expectedKind }
  }
  return null
}

function inferIdentifierKind(value: string): IdentifierKind | null {
  if (EMAIL_RE.test(value)) return 'email'
  if (E164_RE.test(value)) return 'phone'
  // Anything else with no spaces is treated as an external_id; member_id is a
  // narrower internal concept and would only be inferred from a header alias
  // on the CSV side, not from a bare paste entry.
  if (/^\S+$/.test(value)) return 'external_id'
  return null
}

function normaliseIdentifier(value: string, kind: IdentifierKind): string {
  if (kind === 'email') return value.toLowerCase()
  return value
}

function splitDisplayName(raw: string): { firstName?: string; lastName?: string } {
  // Strip surrounding quotes ("Jane Smith" → Jane Smith) — common in mail
  // headers (RFC 5322 §3.4 phrase) but irrelevant to our parsing once trimmed.
  const cleaned = raw.replace(/^"|"$/g, '').trim()
  if (cleaned.length === 0) return {}
  const tokens = cleaned.split(/\s+/)
  if (tokens.length === 1) return { firstName: tokens[0] }
  const lastName = tokens[tokens.length - 1]
  const firstName = tokens.slice(0, -1).join(' ')
  return { firstName, lastName }
}

export interface ParseCsvOptions {
  /** Raw CSV body. */
  body: string
  /** Brand's identifier kind — wins the tie when multiple identifier-shaped columns exist. */
  brandKind: MemberIdentifierKind
}

/**
 * Parses a CSV body. Detects header aliases for identifier and name columns,
 * falls back to per-cell inference when the header is missing or unmatched.
 * Per OQ-S4: explicit firstName / lastName columns win over the bracketed-name
 * form parsed out of an identifier cell, except when the explicit column is
 * empty (the bracketed form fills the gap).
 */
export function parseCsvBody({ body, brandKind }: ParseCsvOptions): ParsedListResult {
  const { headers, rows: dataRows } = parseCsvRaw(body)
  const expectedKind = BRAND_KIND_TO_IDENTIFIER_KIND[brandKind]

  // Map header positions → semantic role (identifier kind or name column).
  type Role = IdentifierKind | 'firstName' | 'lastName'
  const headerRoles: (Role | null)[] = headers.map((h) => {
    const normalised = h.trim().toLowerCase()
    return HEADER_ALIASES[normalised] ?? null
  })

  const identifierColumns: { index: number; kind: IdentifierKind }[] = headerRoles
    .map((role, index) => ({ role, index }))
    .filter((x): x is { role: IdentifierKind; index: number } =>
      x.role === 'email' || x.role === 'phone' || x.role === 'external_id' || x.role === 'member_id',
    )
    .map(({ role, index }) => ({ index, kind: role }))

  const firstNameColumn = headerRoles.findIndex((r) => r === 'firstName')
  const lastNameColumn = headerRoles.findIndex((r) => r === 'lastName')

  // Tie-breaker: when multiple identifier columns are present, prefer the one
  // matching the brand's kind; fall back to the first identifier column.
  const preferredIdentifierColumn =
    identifierColumns.find((c) => c.kind === expectedKind) ?? identifierColumns[0]

  const rows: ParsedRow[] = []
  const unmatched: string[] = []

  for (const cells of dataRows) {
    if (cells.every((c) => (c ?? '').trim() === '')) continue
    const result = parseCsvRow(cells, {
      expectedKind,
      preferredIdentifierColumn,
      firstNameColumn,
      lastNameColumn,
    })
    if (result) {
      rows.push(result)
    } else {
      // Push the joined row so the operator can see what failed in the UI.
      unmatched.push(cells.join(','))
    }
  }

  return { rows, unmatched }
}

interface CsvRowContext {
  expectedKind: IdentifierKind
  preferredIdentifierColumn: { index: number; kind: IdentifierKind } | undefined
  firstNameColumn: number
  lastNameColumn: number
}

function parseCsvRow(cells: string[], ctx: CsvRowContext): ParsedRow | null {
  // Pull the identifier from the preferred column (if any), else per-cell
  // inference across all non-empty cells.
  let identifier: string | null = null
  let identifierFromBracket: { name: string; value: string } | null = null

  if (ctx.preferredIdentifierColumn) {
    const raw = (cells[ctx.preferredIdentifierColumn.index] ?? '').trim()
    if (raw.length > 0) {
      const bracket = raw.match(NAME_EMAIL_RE)
      if (bracket && inferIdentifierKind(bracket[2].trim()) === ctx.expectedKind) {
        identifier = normaliseIdentifier(bracket[2].trim(), ctx.expectedKind)
        identifierFromBracket = { name: bracket[1].trim(), value: bracket[2].trim() }
      } else if (inferIdentifierKind(raw) === ctx.expectedKind) {
        identifier = normaliseIdentifier(raw, ctx.expectedKind)
      }
    }
  } else {
    // No header alias matched — inspect every cell.
    for (const raw of cells) {
      const trimmed = (raw ?? '').trim()
      if (trimmed.length === 0) continue
      if (inferIdentifierKind(trimmed) === ctx.expectedKind) {
        identifier = normaliseIdentifier(trimmed, ctx.expectedKind)
        break
      }
    }
  }

  if (!identifier) return null

  // Names. Explicit columns win except when empty (OQ-S4): then fall back
  // to the bracketed-name form parsed out of the identifier cell.
  let firstName: string | undefined
  let lastName: string | undefined

  const explicitFirst = ctx.firstNameColumn >= 0 ? (cells[ctx.firstNameColumn] ?? '').trim() : ''
  const explicitLast = ctx.lastNameColumn >= 0 ? (cells[ctx.lastNameColumn] ?? '').trim() : ''

  if (explicitFirst.length > 0) firstName = explicitFirst
  if (explicitLast.length > 0) lastName = explicitLast

  if ((firstName === undefined || lastName === undefined) && identifierFromBracket) {
    const split = splitDisplayName(identifierFromBracket.name)
    if (firstName === undefined && split.firstName !== undefined) firstName = split.firstName
    if (lastName === undefined && split.lastName !== undefined) lastName = split.lastName
  }

  const row: ParsedRow = { identifier, identifierKind: ctx.expectedKind }
  if (firstName !== undefined) row.firstName = firstName
  if (lastName !== undefined) row.lastName = lastName
  return row
}
