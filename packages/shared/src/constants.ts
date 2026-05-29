// Issue #423 — Survey Response Review v1.
//
// SENTIMENT thresholds intentionally retained at the existing 0.3 / -0.3 values
// (RFC §10 OQ-3): the spec's 0.33 wording is a typo (corrigendum rides on this
// commit) and five unrelated consumers in apps/worker, apps/api/routes/analytics,
// apps/web/admin/analytics/cx, and apps/web/admin/members already classify
// against the 0.3 boundary with strict `<` / `>` semantics. Changing the
// constant would reclassify rows on those surfaces with no operator benefit at
// the ±0.03 band-width.

export const SENTIMENT = {
  POSITIVE_THRESHOLD: 0.3,
  NEGATIVE_THRESHOLD: -0.3,
  classify(value: number): 'positive' | 'neutral' | 'negative' {
    if (value > 0.3) return 'positive'
    if (value < -0.3) return 'negative'
    return 'neutral'
  },
} as const

// ---------------------------------------------------------------------------
// Score-band tables — Phase 1 of Issue #235 (Issue #423).
//
// Each survey scoring type (NPS / CSAT / CES) admits one default scale today,
// but the table accessor (`bandsForScale`) is shaped to address future scales
// (NPS 1-5, CES 1-5) without UI/API refactors. Phase 1 wires only the default
// scale; unit tests assert the future-scale tables are no-throw addressable.

export type ScoreScale = '0_10' | '1_5' | '1_7'
export type BandKey =
  | 'promoter' | 'passive' | 'detractor'
  | 'satisfied' | 'neutral' | 'dissatisfied'
  | 'easy' | 'hard'

export interface BandRange {
  key: BandKey
  label: string
  min: number
  max: number
}

export interface BandTable {
  scale: ScoreScale
  bands: BandRange[]
  bandOf(score: number): BandKey | null
}

function makeBandTable(scale: ScoreScale, bands: BandRange[]): BandTable {
  return {
    scale,
    bands,
    bandOf(score: number): BandKey | null {
      for (const b of bands) {
        if (score >= b.min && score <= b.max) return b.key
      }
      return null
    },
  }
}

const NPS_BANDS_0_10: BandTable = makeBandTable('0_10', [
  { key: 'promoter',  label: 'Promoter',  min: 9, max: 10 },
  { key: 'passive',   label: 'Passive',   min: 7, max: 8 },
  { key: 'detractor', label: 'Detractor', min: 0, max: 6 },
])

const NPS_BANDS_1_5: BandTable = makeBandTable('1_5', [
  { key: 'promoter',  label: 'Promoter',  min: 5, max: 5 },
  { key: 'passive',   label: 'Passive',   min: 4, max: 4 },
  { key: 'detractor', label: 'Detractor', min: 1, max: 3 },
])

const CSAT_BANDS_1_5: BandTable = makeBandTable('1_5', [
  { key: 'satisfied',    label: 'Satisfied',    min: 4, max: 5 },
  { key: 'neutral',      label: 'Neutral',      min: 3, max: 3 },
  { key: 'dissatisfied', label: 'Dissatisfied', min: 1, max: 2 },
])

const CES_BANDS_1_7: BandTable = makeBandTable('1_7', [
  { key: 'easy',    label: 'Easy',    min: 5, max: 7 },
  { key: 'neutral', label: 'Neutral', min: 4, max: 4 },
  { key: 'hard',    label: 'Hard',    min: 1, max: 3 },
])

const CES_BANDS_1_5: BandTable = makeBandTable('1_5', [
  { key: 'easy',    label: 'Easy',    min: 5, max: 5 },
  { key: 'neutral', label: 'Neutral', min: 4, max: 4 },
  { key: 'hard',    label: 'Hard',    min: 1, max: 3 },
])

export const NPS = {
  // Back-compat with existing consumers (apps/api/routes/surveys.ts imports NPS).
  PROMOTER_THRESHOLD: 9,
  DETRACTOR_THRESHOLD: 6,
  isPromoter(score: number): boolean { return score >= 9 },
  isDetractor(score: number): boolean { return score <= 6 },
  bandsForScale(scale: ScoreScale): BandTable {
    if (scale === '1_5') return NPS_BANDS_1_5
    return NPS_BANDS_0_10
  },
} as const

export const CSAT = {
  bandsForScale(scale: ScoreScale): BandTable {
    // CSAT only ships a 1-5 table in Phase 1; future scales fall back to it.
    void scale
    return CSAT_BANDS_1_5
  },
} as const

export const CES = {
  bandsForScale(scale: ScoreScale): BandTable {
    if (scale === '1_5') return CES_BANDS_1_5
    return CES_BANDS_1_7
  },
} as const

/**
 * Resolves the default `ScoreScale` for a CX survey type. Phase 1 has no
 * `Survey.scoreScale` column on the schema; if/when a successor sub-issue adds
 * the column, this resolver checks the column and falls back to the default.
 */
export function defaultScaleForType(type: 'NPS' | 'CSAT' | 'CES'): ScoreScale {
  switch (type) {
    case 'NPS': return '0_10'
    case 'CSAT': return '1_5'
    case 'CES': return '1_7'
  }
}

const CX_TYPES = new Set(['NPS', 'CSAT', 'CES'])

/**
 * Returns true iff `Survey.type` admits a `Score band` filter. Phase 1 reserves
 * score-band UI to the three standard CX types; custom-type surveys (or any
 * future type) hide the chip group entirely.
 */
export function shouldShowScoreBand(type: string): boolean {
  return CX_TYPES.has(type)
}

/**
 * Returns true iff `Survey.type` admits a `Sentiment band` filter AND the
 * survey has at least one open-ended (text) question. Sentiment is only
 * populated on responses to open-ended text; surveys with no text question
 * never carry sentiment values.
 */
export function shouldShowSentimentBand(type: string, hasOpenEndedQuestion: boolean): boolean {
  return shouldShowScoreBand(type) && hasOpenEndedQuestion
}

/**
 * Maps a stored `SurveyResponse.sentiment` float to a band label. Strict `>` /
 * `<` semantics at the boundaries match the existing `SENTIMENT.classify`
 * consumer; `null` (sentiment unmeasured) returns `null`.
 */
export function sentimentBandOf(value: number | null): 'positive' | 'neutral' | 'negative' | null {
  if (value === null || value === undefined) return null
  if (value > SENTIMENT.POSITIVE_THRESHOLD) return 'positive'
  if (value < SENTIMENT.NEGATIVE_THRESHOLD) return 'negative'
  return 'neutral'
}

// ---------------------------------------------------------------------------
// Export controls (RFC §3.1, §6.2).

/** Maximum rows in a single .xlsx export. Beyond this, the export endpoint
 * returns HTTP 413 `EXPORT_TOO_LARGE`. Adjusting this is a one-line change. */
export const EXPORT_ROW_CAP = 50_000

/** Issue #540 — Canonical public host for all recipient-facing
 * web-surface artifacts: survey-link origin, unsubscribe URLs, admin-UI
 * share URLs, "powered by" footer in exports, the `@`-domain of the
 * support email, and the sender-domain fallback for managed email.
 *
 * Single source of truth for the fallback when env vars
 * (`NEXT_PUBLIC_FRONTEND_URL` / `FRONTEND_URL` / `ADMIN_UI_BASE_URL` /
 * `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM`) are unset.
 *
 * Set declaratively per Container App in `.github/workflows/deploy.yml`;
 * this constant is the loud, in-repo backstop so we never silently
 * degrade to a placeholder host like `app.customereq.example` (the
 * failure mode that produced the #540 production incident).
 *
 * Future multi-tenant per-brand hosts should be resolved via
 * `Brand.publicHost` (not yet introduced); when that lands, swap these
 * consumers to that lookup. */
export const PUBLIC_FRONTEND_HOST = 'customereq.wellnessatwork.me'

/** Full origin form (scheme + host) for URL contexts. Derived from
 * `PUBLIC_FRONTEND_HOST` so the two can never drift. */
export const PUBLIC_FRONTEND_URL = `https://${PUBLIC_FRONTEND_HOST}`

/** Admin-UI base origin. Same host as `PUBLIC_FRONTEND_URL` — both the
 * respondent surface (`/survey/...`) and the admin surface (`/admin/...`)
 * live on the customereq.wellnessatwork.me apex. Alias kept for explicit
 * consumer intent (developer page, OAuth admin-UI redirects, share URLs). */
export const PUBLIC_ADMIN_UI_URL = PUBLIC_FRONTEND_URL

/** Issue #540 — Canonical public API origin. The API does NOT have a
 * custom domain bound today; production accepts traffic at the legacy
 * Azure-generated Container Apps FQDN. Custom-domain binding (e.g.,
 * `api.customereq.wellnessatwork.me`) is tracked as a follow-up so we can
 * land the URL-default fix without an infra prerequisite. When the custom
 * domain binds, update this constant + the `API_BASE_URL` env var on every
 * consuming container in one deploy. */
export const PUBLIC_API_URL =
  'https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'

/** Public host used inside generated documents (exports, emails, PDFs).
 * Identical to `PUBLIC_FRONTEND_URL`; kept as a named alias for documents
 * that reference the host as "powered by" branding (e.g., Excel exports'
 * footer link). New code should import `PUBLIC_FRONTEND_URL`. */
export const EXPORTS_POWERED_BY_URL = PUBLIC_FRONTEND_URL

/** Verbatim caveat copy for AI-derived columns. Used by both the on-screen
 * tooltip indicator and the exported workbook's disclaimer row so they
 * never drift. Operator-facing copy MUST NOT name internal issue numbers. */
export const AI_FIELDS_CAVEAT =
  'AI-derived columns (AI · Sentiment, AI · Topics, AI · Summary) are computed across all open-ended ' +
  'answers per response. For standard NPS / CSAT / CES surveys with one open-ended question, the values ' +
  'are correct. For multi-text-question surveys, interpret with caution — later phases of this product ' +
  'surface will continue refining these AI-derived values to improve accuracy.'
