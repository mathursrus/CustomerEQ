import { type AdapterParseResult, type CanonicalImportRow, matchHeader, normaliseScore, parseDate } from './types.js'

const EMAIL_VARIANTS = ['user', 'email', 'email address', 'email_address', 'respondent_email', 'customer_email']
const DATE_VARIANTS = ['date', 'completed_at', 'response_date', 'submitted_at', 'timestamp', 'response date']
const SCORE_VARIANTS = ['score', 'nps', 'nps_score', 'rating', 'csat', 'ces']
const VERBATIM_VARIANTS = ['verbatim', 'comment', 'feedback', 'review', 'open_ended', 'response']
const CHANNEL_VARIANTS = ['channel', 'source', 'medium']
const EXTERNAL_ID_VARIANTS = ['external_id', 'id', 'respondent_id', 'response_id']

const ALL_MAPPED_VARIANTS = new Set([
  ...EMAIL_VARIANTS,
  ...DATE_VARIANTS,
  ...SCORE_VARIANTS,
  ...VERBATIM_VARIANTS,
  ...CHANNEL_VARIANTS,
  ...EXTERNAL_ID_VARIANTS,
].map((v) => v.toLowerCase().replace(/[\s\-]+/g, '_')))

function isMappedHeader(header: string): boolean {
  return ALL_MAPPED_VARIANTS.has(header.toLowerCase().replace(/[\s\-]+/g, '_'))
}

export function parseExcelRows(
  headers: string[],
  rows: string[][],
  importDate: Date,
): AdapterParseResult {
  const emailIdx = matchHeader(EMAIL_VARIANTS, headers)

  if (emailIdx === -1) {
    return {
      rows: [],
      validationErrors: [
        'Missing required column: user/email. Add a column named "user", "email", or "email address".',
      ],
    }
  }

  const dateIdx = matchHeader(DATE_VARIANTS, headers)
  const scoreIdx = matchHeader(SCORE_VARIANTS, headers)
  const verbatimIdx = matchHeader(VERBATIM_VARIANTS, headers)
  const channelIdx = matchHeader(CHANNEL_VARIANTS, headers)
  const externalIdIdx = matchHeader(EXTERNAL_ID_VARIANTS, headers)

  const out: CanonicalImportRow[] = rows.map((cells) => {
    const rawAnswers: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (!isMappedHeader(h) && cells[i] !== undefined && cells[i] !== '') {
        rawAnswers[h] = cells[i]
      }
    })

    const rawScore = scoreIdx !== -1 ? (cells[scoreIdx] ?? '') : ''
    const rawDate = dateIdx !== -1 ? (cells[dateIdx] ?? '') : ''
    const rawChannel = channelIdx !== -1 ? (cells[channelIdx] ?? '') : ''

    return {
      email: cells[emailIdx]?.trim() || null,
      score: rawScore ? normaliseScore(rawScore) : null,
      verbatim: verbatimIdx !== -1 && cells[verbatimIdx]?.trim() ? cells[verbatimIdx].trim() : null,
      completedAt: parseDate(rawDate, importDate),
      channel: rawChannel || 'link',
      externalId: externalIdIdx !== -1 && cells[externalIdIdx]?.trim() ? cells[externalIdIdx].trim() : null,
      rawAnswers,
      sourceType: 'excel',
    }
  })

  return { rows: out, validationErrors: [] }
}
