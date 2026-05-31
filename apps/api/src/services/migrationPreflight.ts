// Issue #524 — identifier-migration pre-flight validator (R6–R12).
//
// Pure, DB-free. The route layer (`POST /v1/admin/brand/migrations/:id/mapping`)
// fetches the brand's Member rows + parses the uploaded CSV (or builds the
// fast-path source from existing `Member.email`), then calls validatePreflight.
// No member rows are written here — validation precedes any write (R6).
//
// Direction-agnostic note: this slice validates a CUSTOMER_ID → EMAIL mapping.
// The `new_email` column is the target external id; shape is checked with the
// shared EMAIL_RE so the migration contract never drifts from live enrollment.

import { EMAIL_RE, normalizeExternalId } from './memberResolution.js'

export type MappingRow = {
  /** 1-based row number within the uploaded file (for R12 per-row display). */
  row: number
  /** Raw value from the `customer_id` column (trimmed; case preserved). */
  customerId: string
  /** Raw value from the `new_email` column (trimmed; case preserved). */
  newEmail: string
}

export type PreflightMember = {
  /** Stable internal Member.id (cuid) — survives the re-key. */
  memberId: string
  /** The member's CURRENT externalId (lowered) = the brand's `customer_id`. */
  customerId: string
  /** Existing PII sidecar email, if any (fast-path source). */
  email: string | null
}

export type PreflightRowIssueReason = 'unmapped' | 'collision' | 'invalid_shape'

export type RowIssue = {
  /** Present for issues tied to a file row; absent for unmapped members. */
  row?: number
  customerId: string
  newEmail?: string
  reason: PreflightRowIssueReason
  detail: string
}

export type MigrationPreflightResult = {
  /** true iff zero blocking issues (R11 — migration startable). */
  ok: boolean
  counts: {
    totalRows: number
    membersMatched: number
    unmappedMembers: number
    collisions: number
    invalidShape: number
  }
  rowIssues: RowIssue[]
}

// Matching + collision detection use the shared canonical-key derivation
// (normalizeExternalId) so the pre-flight result agrees with the re-key worker.

/**
 * Parse a `customer_id,new_email` CSV into rows. Column order is irrelevant;
 * both columns are required. Values are trimmed (case preserved — normalization
 * happens in validatePreflight). Returns `{ rows: [], error }` on any structural
 * problem (R6 — clear message, nothing written).
 */
export function parseMappingCsv(csv: string): { rows: MappingRow[]; error?: string } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { rows: [], error: 'The uploaded file is empty.' }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const customerIdIdx = header.indexOf('customer_id')
  const newEmailIdx = header.indexOf('new_email')
  if (customerIdIdx === -1 || newEmailIdx === -1) {
    return {
      rows: [],
      error: 'The file must have a header row with both "customer_id" and "new_email" columns.',
    }
  }

  const rows: MappingRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    rows.push({
      row: i, // 1-based relative to the first data row
      customerId: (cells[customerIdIdx] ?? '').trim(),
      newEmail: (cells[newEmailIdx] ?? '').trim(),
    })
  }
  return { rows }
}

/** Minimal CSV cell splitter: supports double-quoted cells containing commas. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

/**
 * Build the mapping rows for the fast path (R28) directly from members'
 * existing `Member.email`. A member with no email yields a blank `newEmail`
 * so validatePreflight surfaces it (the fast path is only offered when none
 * are blank/invalid/colliding — see R28/R29).
 */
export function buildFastPathRows(members: PreflightMember[]): MappingRow[] {
  return members.map((m, idx) => ({
    row: idx + 1,
    customerId: m.customerId,
    newEmail: m.email ?? '',
  }))
}

/**
 * Pre-flight validation (R6–R12). Pure: no DB, no writes.
 * - R8 coverage: every member must have a matching row (by normalized customerId).
 * - R9 collision: two rows whose normalized new_email collide → both flagged.
 * - R10 shape: new_email must match EMAIL_RE.
 * - R7 counts + R12 per-row detail.
 */
export function validatePreflight(
  members: PreflightMember[],
  rows: MappingRow[],
): MigrationPreflightResult {
  const rowIssues: RowIssue[] = []

  // Index rows by normalized customer id for coverage matching.
  const rowsByCustomerId = new Map<string, MappingRow>()
  for (const r of rows) {
    rowsByCustomerId.set(normalizeExternalId(r.customerId), r)
  }

  // R8 — coverage: every member must be mapped.
  let unmappedMembers = 0
  let membersMatched = 0
  for (const m of members) {
    const key = normalizeExternalId(m.customerId)
    if (rowsByCustomerId.has(key)) {
      membersMatched++
    } else {
      unmappedMembers++
      rowIssues.push({
        customerId: m.customerId,
        reason: 'unmapped',
        detail: `Member "${m.customerId}" has no row in the uploaded file. Every existing member must be mapped before migrating.`,
      })
    }
  }

  // R9 — collision: group rows by normalized new_email; any group >1 → all flagged.
  const byEmail = new Map<string, MappingRow[]>()
  for (const r of rows) {
    const norm = normalizeExternalId(r.newEmail)
    if (norm.length === 0) continue // blank handled as invalid_shape below
    const group = byEmail.get(norm) ?? []
    group.push(r)
    byEmail.set(norm, group)
  }
  const collisionRowNumbers = new Set<number>()
  let collisions = 0
  for (const [, group] of byEmail) {
    if (group.length > 1) {
      for (const r of group) {
        collisionRowNumbers.add(r.row)
        collisions++
        rowIssues.push({
          row: r.row,
          customerId: r.customerId,
          newEmail: r.newEmail,
          reason: 'collision',
          detail: `"${r.newEmail}" is used by more than one member. Each member must map to a unique email.`,
        })
      }
    }
  }

  // R10 — shape: new_email must be a valid email. (A blank/invalid email that is
  // also part of a collision can't happen — blanks are skipped above — so the
  // two checks don't double-count the same row.)
  let invalidShape = 0
  for (const r of rows) {
    if (collisionRowNumbers.has(r.row)) continue
    if (!EMAIL_RE.test(r.newEmail.trim())) {
      invalidShape++
      rowIssues.push({
        row: r.row,
        customerId: r.customerId,
        newEmail: r.newEmail,
        reason: 'invalid_shape',
        detail: r.newEmail.trim().length === 0
          ? `Row ${r.row} (${r.customerId}) has no email. Provide a valid email for every member.`
          : `"${r.newEmail}" is not a valid email address.`,
      })
    }
  }

  const ok = unmappedMembers === 0 && collisions === 0 && invalidShape === 0
  return {
    ok,
    counts: {
      totalRows: rows.length,
      membersMatched,
      unmappedMembers,
      collisions,
      invalidShape,
    },
    rowIssues,
  }
}
