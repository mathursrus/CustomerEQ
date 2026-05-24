// Issue #420 — shared audience-builder types.
//
// Both SELF_SERVE and MANAGED_EMAIL flows mount the same <AudienceBuilder>
// (spec §2.2 + R16/R18/R20/R22/R23/R43), so the row + state shapes live in a
// shared module both sides import.

import type { SurveySuppressionStatus } from '@customerEQ/shared'

/**
 * One row in the accumulated audience list. Sourced from Existing Search,
 * Random Sample, or Custom List — the `source` field records which card
 * contributed the row so the UI can surface a Source chip (mock §2.2).
 *
 * Dedup key is `memberId ?? identifier.toLowerCase()`. If an identifier was
 * added from multiple cards, the first one wins (Existing search beats
 * Custom List paste per R21).
 */
export interface AudienceRow {
  memberId: string | null
  /** What the operator typed / what the brand stores — externalId for
   * existing members, the raw pasted string for unmatched/auto-enroll. */
  identifier: string
  email: string | null
  firstName: string | null
  lastName: string | null
  /** ISO timestamp of the member's most recent response to THIS survey, or null. */
  lastResponseThisSurvey: string | null
  /** Issue #420 G22 — ISO timestamp of the member's most recent response to
   *  any survey (including this one), or null. Restored from the pre-#420 spec
   *  which had both columns; #420 dropped lastResponseAnySurvey by mistake. */
  lastResponseAnySurvey: string | null

  source: 'EXISTING_SEARCH' | 'EXISTING_RANDOM' | 'CUSTOM_LIST'
  /** Custom-List rows that will be auto-created on Generate (no existing match). */
  willAutoEnroll: boolean

  /** From {@link deriveSurveySuppression} on the server. */
  suppressionStatus: SurveySuppressionStatus
  suppressionSince: string | null

  /** Operator's per-row selection. Suppressed rows are always `false` and the
   * UI disables the checkbox to enforce R22. */
  selected: boolean
}

export interface AudienceBuilderState {
  rows: AudienceRow[]
  selectedCount: number
  willAutoEnrollCount: number
  suppressedCount: number
  /** Submission payload — encoded as a `mode: 'custom_list'` paste of the
   * selected rows' identifiers + autoEnroll=true (which is harmless for
   * already-matched rows). Parent flows include this in their POST body. */
  submitAudience: {
    mode: 'custom_list'
    identifiers: string
    autoEnroll: boolean
  }
}

export type BrandIdentifierKind = 'email' | 'phone' | 'external_id'

/** Shape returned by `GET /v1/members?q=…&page=…&pageSize=…`. Mirror of the
 * route's response in apps/api/src/routes/members.ts (post-Issue-420
 * extension). Keep in lockstep with that handler. */
export interface MembersSearchResponse {
  data: Array<{
    id: string
    externalId: string
    email: string | null
    firstName: string | null
    lastName: string | null
    suppressionStatus: SurveySuppressionStatus
    suppressionSince: string | null
    // Issue #420 G22 — present when the route is called with ?surveyId=...
    // (the audience builder always does); absent for Customer-360 search calls.
    lastResponseThisSurvey?: string | null
    lastResponseAnySurvey?: string | null
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Shape returned by `POST /v1/surveys/:id/distribution-batches/preview`. */
export interface PreviewResponse {
  audienceCount: number
  willAutoEnrollCount: number
  unmatchedCount: number
  parsedRowCount?: number
  members: Array<{
    memberId: string | null
    identifier: string
    email: string | null
    firstName: string | null
    lastName: string | null
    lastResponseThisSurvey: string | null
    lastResponseAnySurvey: string | null
    willAutoEnroll?: boolean
    suppressionStatus: SurveySuppressionStatus
    suppressionSince: string | null
  }>
  unmatched: string[]
  totalRows: number
}
