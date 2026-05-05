import { type AdapterParseResult, type CanonicalImportRow, matchHeader, parseDate } from './types.js'

const REVIEWER_VARIANTS = ['reviewer', 'reviewer name', 'author']
const RATING_VARIANTS = ['star rating', 'star_rating', 'stars', 'rating']
const REVIEW_VARIANTS = ['review', 'review text', 'review_text', 'comment', 'feedback']
const DATE_VARIANTS = ['date', 'review date', 'review_date', 'submitted_at', 'timestamp']
const REVIEW_ID_VARIANTS = ['review id', 'review_id', 'id']

export function parseGoogleReviewsRows(
  headers: string[],
  rows: string[][],
  importDate: Date,
): AdapterParseResult {
  const reviewerIdx = matchHeader(REVIEWER_VARIANTS, headers)
  const ratingIdx = matchHeader(RATING_VARIANTS, headers)
  const reviewIdx = matchHeader(REVIEW_VARIANTS, headers)
  const dateIdx = matchHeader(DATE_VARIANTS, headers)
  const reviewIdIdx = matchHeader(REVIEW_ID_VARIANTS, headers)

  const out: CanonicalImportRow[] = rows.map((cells) => {
    const rawRating = ratingIdx !== -1 ? (cells[ratingIdx] ?? '') : ''
    const rawDate = dateIdx !== -1 ? (cells[dateIdx] ?? '') : ''
    const reviewerName = reviewerIdx !== -1 ? (cells[reviewerIdx]?.trim() ?? '') : ''
    const reviewText = reviewIdx !== -1 ? (cells[reviewIdx]?.trim() ?? '') : ''
    const reviewId = reviewIdIdx !== -1 ? (cells[reviewIdIdx]?.trim() ?? '') : ''

    const stars = rawRating ? parseFloat(rawRating) : NaN
    const score = isNaN(stars) ? null : Math.min(10, Math.max(0, stars * 2))

    const rawAnswers: Record<string, unknown> = {}
    if (reviewerName) rawAnswers['reviewer_name'] = reviewerName

    return {
      email: null,
      score,
      verbatim: reviewText || null,
      completedAt: parseDate(rawDate, importDate),
      channel: 'review',
      externalId: reviewId || null,
      rawAnswers,
      sourceType: 'google_reviews',
    }
  })

  return { rows: out, validationErrors: [] }
}
