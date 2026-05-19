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

/** Canonical CustomerEQ host used inside generated documents (exports,
 * emails, PDFs). When the production host changes, this single edit
 * propagates everywhere. */
export const EXPORTS_POWERED_BY_URL = 'https://customereq.wellnessatwork.me'

/** Verbatim caveat copy for AI-derived columns. Used by both the on-screen
 * tooltip indicator and the exported workbook's disclaimer row so they
 * never drift. Operator-facing copy MUST NOT name internal issue numbers. */
export const AI_FIELDS_CAVEAT =
  'AI-derived columns (AI · Sentiment, AI · Topics, AI · Summary) are computed across all open-ended ' +
  'answers per response. For standard NPS / CSAT / CES surveys with one open-ended question, the values ' +
  'are correct. For multi-text-question surveys, interpret with caution — later phases of this product ' +
  'surface will continue refining these AI-derived values to improve accuracy.'
