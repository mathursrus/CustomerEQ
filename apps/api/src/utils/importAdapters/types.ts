export const SOURCE_TYPES = ['excel', 'google_reviews'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export interface CanonicalImportRow {
  email: string | null
  score: number | null
  verbatim: string | null
  completedAt: Date
  channel: string
  externalId: string | null
  rawAnswers: Record<string, unknown>
  sourceType: SourceType
}

export interface AdapterParseResult {
  rows: CanonicalImportRow[]
  validationErrors: string[]
}

export interface SourceAdapter {
  sourceType: SourceType
  parse(headers: string[], rows: string[][]): AdapterParseResult
}

/**
 * Match a column by checking multiple name variants against actual headers.
 * Comparison is case-insensitive; spaces, dashes, and underscores are treated as equivalent.
 * Returns the 0-based column index, or -1 if not found.
 */
export function matchHeader(variants: string[], headers: string[]): number {
  const normalise = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_')
  const normHeaders = headers.map(normalise)
  for (const v of variants) {
    const idx = normHeaders.indexOf(normalise(v))
    if (idx !== -1) return idx
  }
  return -1
}

/** Parse a score value and normalise it to 0–10. Returns null if unparseable. */
export function normaliseScore(raw: string): number | null {
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  if (n <= 5) return Math.round(n * 2 * 10) / 10   // 1–5 scale → 0–10
  if (n <= 7) return Math.round(n * 1.43 * 10) / 10 // 1–7 scale → 0–10
  return Math.min(10, Math.max(0, n))               // already 0–10
}

/** Parse a date string. Returns the provided fallback if unparseable. */
export function parseDate(raw: string, fallback: Date): Date {
  if (!raw) return fallback
  const d = new Date(raw)
  return isNaN(d.getTime()) ? fallback : d
}
