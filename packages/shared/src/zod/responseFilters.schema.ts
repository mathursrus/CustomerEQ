// Issue #423 — Survey Response Review v1.
// Single source of truth for the `wave / submittedFrom / submittedTo /
// scoreBands / sentimentBands / channels` filter contract. Shared between the
// API routes (apps/api/src/routes/surveys.ts: list + export) and the web
// filter URL codec (apps/web/src/components/filters/responseFilters.url.ts).

import { z } from 'zod'

/** Wave selection: 'all' (default), 'direct' (no batch / no import), or a
 * cuid identifying a DistributionBatch. Cuid regex matches Prisma's
 * `@id @default(cuid())` shape (c + 24+ base32 chars). */
export const WaveSelection = z.union([
  z.literal('all'),
  z.literal('direct'),
  z.string().regex(/^c[a-z0-9]{24,}$/, 'invalid batch id'),
])

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')

export const ScoreBand = z.enum([
  'promoter', 'passive', 'detractor',
  'satisfied', 'neutral', 'dissatisfied',
  'easy', 'hard',
])
export type ScoreBandKey = z.infer<typeof ScoreBand>

export const SentimentBand = z.enum(['positive', 'neutral', 'negative'])
export type SentimentBandKey = z.infer<typeof SentimentBand>

/** Filter inputs shared by list + export endpoints. */
export const ResponseFiltersSchema = z.object({
  wave: WaveSelection.default('all'),
  submittedFrom: dateOnly.optional(),
  submittedTo: dateOnly.optional(),
  scoreBands: z.array(ScoreBand).optional(),
  sentimentBands: z.array(SentimentBand).optional(),
  channels: z.array(z.string()).optional(),
})
export type ResponseFilters = z.infer<typeof ResponseFiltersSchema>

/** Query params for `GET /v1/surveys/:id/responses` — adds page/pageSize.
 * `pageSize` capped at 500 server-side; the UI chip selector emits only
 * 25/50/100 (R11 / R11a). */
export const ResponseListQuerySchema = ResponseFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
})
export type ResponseListQuery = z.infer<typeof ResponseListQuerySchema>

/** Query params for `GET /v1/surveys/:id/responses.xlsx` — no page/pageSize. */
export const ResponseExportQuerySchema = ResponseFiltersSchema
export type ResponseExportQuery = z.infer<typeof ResponseExportQuerySchema>

/** Normalizes a comma-separated query string into an array. Fastify's
 * default query parser keeps multi-value `scoreBands=a&scoreBands=b` as an
 * array but URL codecs that emit `scoreBands=a,b` need this. */
export function splitCsvArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) return value.map(String)
  return String(value).split(',').filter(Boolean)
}
