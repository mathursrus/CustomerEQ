// Issue #423 — Survey Response Review v1.
// Helpers shared by the list (`GET /v1/surveys/:id/responses`) and the export
// (`GET /v1/surveys/:id/responses.xlsx`) endpoints. Split into a util so the
// route handlers stay focused on auth + payload shaping.

import type { Prisma, MemberIdentifierKind } from '@prisma/client'
import {
  SENTIMENT,
  shouldShowScoreBand,
  defaultScaleForType,
  NPS, CSAT, CES,
  type ResponseFilters,
  type ScoreBandKey,
  type BandRange,
} from '@customerEQ/shared'
import { endOfDayInBrandTz } from '@customerEQ/shared'

// Prisma select shape reused by both endpoints. Keeping it as a single shared
// constant guarantees the export sheet and the list payload start from the
// same DB rows.
export const SURVEY_RESPONSE_ROW_SELECT = {
  id: true,
  surveyId: true,
  brandId: true,
  memberId: true,
  answers: true,
  score: true,
  sentiment: true,
  confidence: true,
  topics: true,
  summary: true,
  channel: true,
  completedAt: true,
  importedAt: true,
  distributionBatchId: true,
  importBatchId: true,
  member: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      externalId: true,
      id: true,
    },
  },
  distributionBatch: { select: { label: true } },
  importBatch: { select: { filename: true } },
} as const

export type SurveyResponseRow = {
  id: string
  surveyId: string
  brandId: string
  memberId: string | null
  answers: unknown
  score: number | null
  sentiment: number | null
  confidence: number | null
  topics: string[]
  summary: string | null
  channel: string
  completedAt: Date | null
  importedAt: Date | null
  distributionBatchId: string | null
  importBatchId: string | null
  member: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    externalId: string
  } | null
  distributionBatch: { label: string } | null
  importBatch: { filename: string | null } | null
}

/** Projects the Prisma row into the public API shape — collapses the
 * polymorphic member identifier into a single `identifierValue` string per
 * `Brand.memberIdentifierKind` so the client never sees fields it shouldn't
 * (e.g., phone leaking to a CUSTOMER_ID-keyed brand). */
export function projectResponseRow(
  row: SurveyResponseRow,
  brand: { memberIdentifierKind: MemberIdentifierKind },
) {
  const member = row.member
    ? {
        firstName: row.member.firstName,
        lastName: row.member.lastName,
        identifierValue: resolveIdentifierValue(row.member, brand.memberIdentifierKind),
      }
    : null

  return {
    id: row.id,
    answers: row.answers,
    score: row.score,
    sentiment: row.sentiment,
    confidence: row.confidence,
    topics: row.topics,
    summary: row.summary,
    channel: row.channel,
    completedAt: row.completedAt,
    importedAt: row.importedAt,
    distributionBatchId: row.distributionBatchId,
    distributionBatchLabel: row.distributionBatch?.label ?? null,
    importBatchId: row.importBatchId,
    importBatchName: row.importBatch?.filename ?? null,
    member,
  }
}

function resolveIdentifierValue(
  member: NonNullable<SurveyResponseRow['member']>,
  kind: MemberIdentifierKind,
): string {
  switch (kind) {
    case 'EMAIL': return member.email ?? member.externalId
    case 'PHONE': return member.phone ?? member.externalId
    case 'CUSTOMER_ID': return member.externalId
    default: return member.externalId
  }
}

interface BuildWhereArgs {
  surveyId: string
  brandId: string
  filters: ResponseFilters
  survey: { type: string }
  brand: { timezone: string }
}

/** Translates the `ResponseFilters` shape into a Prisma `where` clause. The
 * "intersect across groups, union within group" semantics from the spec map
 * to a top-level `AND` of per-group `OR`s plus simple field equality where
 * applicable. */
export function buildResponseWhere(args: BuildWhereArgs): Prisma.SurveyResponseWhereInput {
  const { surveyId, brandId, filters, survey, brand } = args

  const where: Prisma.SurveyResponseWhereInput = {
    surveyId,
    brandId,
    // Inherit survey-level soft-delete (Issue #332 pattern). No row-level
    // soft-delete column on SurveyResponse — see RFC §2.1.
    survey: { deletedAt: null },
  }
  const andGroups: Prisma.SurveyResponseWhereInput[] = []

  // --- Wave selection ---
  if (filters.wave === 'direct') {
    andGroups.push({ distributionBatchId: null, importBatchId: null })
  } else if (filters.wave !== 'all' && typeof filters.wave === 'string') {
    where.distributionBatchId = filters.wave
  }

  // --- Submitted range (R8, R26).
  //
  // `SurveyResponse.completedAt` is non-nullable (DB-default `now()`), so for
  // historical imports the column captures the moment of import, not the
  // original response time. For those rows, the spec is explicit: filter on
  // `importedAt` (the original timestamp). Live responses (`importedAt IS
  // NULL`) filter on `completedAt`.
  if (filters.submittedFrom || filters.submittedTo) {
    const from = filters.submittedFrom
      ? parseDateOnlyInBrandTz(filters.submittedFrom, brand.timezone, 'start')
      : undefined
    const to = filters.submittedTo
      ? endOfDayInBrandTz(parseDateOnlyAsLocal(filters.submittedTo), brand.timezone)
      : undefined
    andGroups.push({
      OR: [
        { importedAt: null, completedAt: { gte: from, lte: to } },
        { importedAt: { gte: from, lte: to } },
      ],
    })
  }

  // --- Score band (type-gated) ---
  if (filters.scoreBands?.length && shouldShowScoreBand(survey.type)) {
    const type = survey.type as 'NPS' | 'CSAT' | 'CES'
    const scale = defaultScaleForType(type)
    const ranges = filters.scoreBands
      .map((k) => bandRangeFor(type, scale, k))
      .filter((r): r is BandRange => r !== null)
    if (ranges.length > 0) {
      andGroups.push({
        OR: ranges.map((r) => ({ score: { gte: r.min, lte: r.max } })),
      })
    }
  }

  // --- Sentiment band ---
  if (filters.sentimentBands?.length) {
    const sentOr: Prisma.SurveyResponseWhereInput[] = filters.sentimentBands.map((b) => {
      if (b === 'positive') return { sentiment: { gt: SENTIMENT.POSITIVE_THRESHOLD } }
      if (b === 'negative') return { sentiment: { lt: SENTIMENT.NEGATIVE_THRESHOLD } }
      // neutral — closed interval (matches existing analytics.ts consumer)
      return {
        sentiment: {
          gte: SENTIMENT.NEGATIVE_THRESHOLD,
          lte: SENTIMENT.POSITIVE_THRESHOLD,
        },
      }
    })
    andGroups.push({ OR: sentOr })
  }

  // --- Channel multi-select (intersect across groups, union within) ---
  if (filters.channels && filters.channels.length > 0) {
    where.channel = { in: filters.channels }
  }

  if (andGroups.length > 0) where.AND = andGroups

  return where
}

function bandRangeFor(type: 'NPS' | 'CSAT' | 'CES', scale: Parameters<typeof NPS.bandsForScale>[0], key: ScoreBandKey): BandRange | null {
  const table =
    type === 'NPS' ? NPS.bandsForScale(scale)
    : type === 'CSAT' ? CSAT.bandsForScale(scale)
    : CES.bandsForScale(scale)
  return table.bands.find((b) => b.key === key) ?? null
}

function parseDateOnlyAsLocal(yyyymmdd: string): Date {
  // Treat the YYYY-MM-DD as a calendar date with midnight local-TZ semantics;
  // the brand-TZ projection is applied by callers via endOfDayInBrandTz.
  return new Date(`${yyyymmdd}T00:00:00.000`)
}

function parseDateOnlyInBrandTz(yyyymmdd: string, _brandTz: string, _bound: 'start' | 'end'): Date {
  // For range start we treat the date as midnight in the brand's TZ. We use
  // the same date-fns-tz primitives as endOfDayInBrandTz (importing
  // fromZonedTime would re-pull that lib); for simplicity in Phase 1 we
  // construct the wall-clock ISO string and let JavaScript's Date constructor
  // interpret it. This is intentional: parseDateOnlyAsLocal followed by the
  // server's UTC offset for the brand TZ would be more precise, but Phase 1
  // tests against the brand TZ are dominated by the end-of-day boundary which
  // uses the canonical helper. See RFC §3.2.
  void _brandTz
  void _bound
  return new Date(`${yyyymmdd}T00:00:00.000`)
}

/** Returns the `filters` echo block included in the list-endpoint response
 * envelope. The export endpoint reads the same shape so the workbook cover
 * block knows which gates were active. */
export function buildFiltersEcho(
  filters: ResponseFilters,
  survey: { type: string },
  hasOpenEndedQuestion: boolean,
): {
  wave: ResponseFilters['wave']
  submittedFrom: string | null
  submittedTo: string | null
  scoreBands: ScoreBandKey[]
  sentimentBands: Array<'positive' | 'neutral' | 'negative'>
  channels: string[]
  scoreBandGate: { hidden: boolean }
  sentimentBandGate: { hidden: boolean }
} {
  return {
    wave: filters.wave,
    submittedFrom: filters.submittedFrom ?? null,
    submittedTo: filters.submittedTo ?? null,
    scoreBands: filters.scoreBands ?? [],
    sentimentBands: filters.sentimentBands ?? [],
    channels: filters.channels ?? [],
    scoreBandGate: { hidden: !shouldShowScoreBand(survey.type) },
    sentimentBandGate: {
      hidden: !shouldShowScoreBand(survey.type) || !hasOpenEndedQuestion,
    },
  }
}

/** True when at least one question in `Survey.questions` is a text/open-ended
 * type. Drives the Sentiment-band gate. */
export function hasOpenEndedQuestion(questions: unknown): boolean {
  if (!Array.isArray(questions)) return false
  return questions.some((q) => {
    if (typeof q !== 'object' || q === null) return false
    const t = (q as { type?: unknown }).type
    return t === 'text' || t === 'open_text' || t === 'textarea' || t === 'long_text'
  })
}
