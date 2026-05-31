// Issue #524 Slice 1 — typed client for the member-identifier-kind migration
// API (apps/api/src/routes/adminBrandMigrations.ts). Single source of fetch
// truth so wizard / status panels / section / banner never duplicate request
// code. Every helper takes Clerk's `getToken` and attaches the Bearer header.

import { API_URL, getAuthToken } from '@/lib/config'

// ───────────────────────────── types ───────────────────────────────────────

export type MigrationStatus =
  | 'PENDING_VALIDATION'
  | 'VALIDATED'
  | 'PROCESSING'
  | 'REKEY_COMPLETE_IN_GRACE'
  | 'GRACE_EXPIRED'
  | 'FAILED'
  | 'CANCELLED'

export type MemberIdentifierKind = 'EMAIL' | 'PHONE' | 'CUSTOMER_ID'

/** Per-ingress old-key usage counters returned alongside a migration. */
export interface OldKeyUsage {
  PUBLIC_SURVEY_RESPOND: number
  API_MEMBERS_ENROLL: number
  DISTRIBUTION_BATCH: number
}

export type OldKeyIngress = keyof OldKeyUsage

export interface Migration {
  id: string
  status: MigrationStatus
  fromKind: MemberIdentifierKind
  toKind: MemberIdentifierKind
  totalMembers: number
  processedMembers: number
  failedMembers: number
  reconciledMembers: number
  remainingMembers: number
  rekeyCompletedAt: string | null
  graceExpiresAt: string | null
  graceExtensions: unknown[]
  oldKeyUsage: OldKeyUsage
  /** Per-member errors — populated only for a FAILED migration (R24). */
  errorRows: Array<{ customerId: string; newEmail: string; error: string }>
  createdAt: string
}

export interface PreflightCounts {
  total: number
  withEmail: number
  withoutEmail: number
  collisionGroups: number
  invalidShape: number
}

export interface ImpactPreviewRow {
  surface: string
  lastSeenAt: string | null
  count30d: number
  brandSideAction: string
}

export interface PreflightContext {
  counts: PreflightCounts
  fastPathAvailable: boolean
  impactPreview: ImpactPreviewRow[]
}

export type RowIssueReason = 'unmapped' | 'collision' | 'invalid_shape'

export interface RowIssue {
  row?: number
  customerId: string
  newEmail?: string
  reason: RowIssueReason
  detail: string
}

export interface PreflightResult {
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

export interface UsageWarning {
  kind: 'IDENTIFIER_MIGRATION_PRE_EXPIRY'
  migrationId: string
  graceExpiresAt: string
  daysRemaining: number
  oldKeyIngressesActive: Array<{ ingress: OldKeyIngress; count7d: number }>
}

/** Shape of the JSON error body returned on a 409 create conflict. */
export interface MigrationConflict {
  code: 'MIGRATION_ALREADY_IN_PROGRESS'
  migrationId: string
  redirectTo: string
  error?: string
}

/** Thrown by createMigration on a 409 so callers can redirect. */
export class MigrationInProgressError extends Error {
  readonly conflict: MigrationConflict
  constructor(conflict: MigrationConflict) {
    super(conflict.error ?? 'A migration is already in progress.')
    this.name = 'MigrationInProgressError'
    this.conflict = conflict
  }
}

export type GetToken = () => Promise<string | null>

// ───────────────────────────── internals ───────────────────────────────────

const BASE = `${API_URL}/v1/admin/brand`

async function authHeaders(getToken: GetToken): Promise<Record<string, string>> {
  const token = await getAuthToken(getToken)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) return body.error
  } catch {
    // body wasn't JSON — fall through
  }
  return `${fallback} (HTTP ${res.status})`
}

// ───────────────────────────── helpers ─────────────────────────────────────

/** GET /current → the brand's most recent non-cancelled migration, or null. */
export async function getCurrentMigration(getToken: GetToken): Promise<Migration | null> {
  const res = await fetch(`${BASE}/migrations/current`, {
    cache: 'no-store',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load migration'))
  return (await res.json()) as Migration | null
}

/** GET /:id → a single migration (used for polling). */
export async function getMigration(getToken: GetToken, id: string): Promise<Migration> {
  const res = await fetch(`${BASE}/migrations/${id}`, {
    cache: 'no-store',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load migration'))
  return (await res.json()) as Migration
}

/** GET /preflight-context → fast-path signals + counts + impact preview. */
export async function getPreflightContext(getToken: GetToken): Promise<PreflightContext> {
  const res = await fetch(`${BASE}/migrations/preflight-context`, {
    cache: 'no-store',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load preflight context'))
  return (await res.json()) as PreflightContext
}

/** POST /migrations → create. Throws MigrationInProgressError on 409. */
export async function createMigration(getToken: GetToken): Promise<Migration> {
  const res = await fetch(`${BASE}/migrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({}),
  })
  if (res.status === 409) {
    const conflict = (await res.json()) as MigrationConflict
    throw new MigrationInProgressError(conflict)
  }
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to start a migration'))
  return (await res.json()) as Migration
}

/** POST /:id/mapping with JSON { mode: 'from_existing_emails' }. */
export async function submitMappingFromExisting(
  getToken: GetToken,
  id: string,
): Promise<PreflightResult> {
  const res = await fetch(`${BASE}/migrations/${id}/mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ mode: 'from_existing_emails' }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Validation failed'))
  return (await res.json()) as PreflightResult
}

/** POST /:id/mapping with a raw CSV body (text/csv). */
export async function submitMappingCsv(
  getToken: GetToken,
  id: string,
  csv: string,
): Promise<PreflightResult> {
  const res = await fetch(`${BASE}/migrations/${id}/mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv', ...(await authHeaders(getToken)) },
    body: csv,
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not parse the CSV'))
  return (await res.json()) as PreflightResult
}

/** POST /:id/start with the attestation block. */
export async function startMigration(
  getToken: GetToken,
  id: string,
  attestationText: string,
): Promise<{ status: 'PROCESSING'; migrationId: string }> {
  const res = await fetch(`${BASE}/migrations/${id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ attestationText, confirmed: true }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not start the migration'))
  return (await res.json()) as { status: 'PROCESSING'; migrationId: string }
}

/** POST /:id/extend-grace by a number of days. */
export async function extendGrace(
  getToken: GetToken,
  id: string,
  deltaDays: number,
): Promise<{ graceExpiresAt: string }> {
  const res = await fetch(`${BASE}/migrations/${id}/extend-grace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ deltaDays }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not extend the grace window'))
  return (await res.json()) as { graceExpiresAt: string }
}

/** POST /:id/cancel — only valid before any write. */
export async function cancelMigration(
  getToken: GetToken,
  id: string,
): Promise<{ status: 'CANCELLED' }> {
  const res = await fetch(`${BASE}/migrations/${id}/cancel`, {
    method: 'POST',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not cancel the migration'))
  return (await res.json()) as { status: 'CANCELLED' }
}

/** GET /usage-warnings → brand-wide pre-expiry warning, or null. */
export async function getUsageWarnings(getToken: GetToken): Promise<UsageWarning | null> {
  const res = await fetch(`${BASE}/usage-warnings`, {
    cache: 'no-store',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load usage warnings'))
  return (await res.json()) as UsageWarning | null
}

/**
 * GET /mapping-template.csv and trigger a browser download. Fetches with the
 * Bearer header (the endpoint is auth-gated, so a plain anchor href can't carry
 * the token), then materializes a Blob and clicks a temporary anchor.
 */
export async function downloadMappingTemplate(getToken: GetToken): Promise<void> {
  const res = await fetch(`${BASE}/migrations/mapping-template.csv`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not download the template'))
  const text = await res.text()
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'member-identifier-mapping.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
