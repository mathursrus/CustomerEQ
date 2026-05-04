import { describe, it, expect } from 'vitest'
import { parseGoogleReviewsRows } from './googleReviewsAdapter.js'

const NOW = new Date('2026-01-01T00:00:00Z')

describe('Google Reviews adapter — star rating normalisation', () => {
  it('normalises 5-star to score 10', () => {
    const headers = ['Reviewer', 'Star Rating', 'Review', 'Date']
    const rows = [['Alice', '5', 'Excellent', '2025-11-01']]
    const { rows: out } = parseGoogleReviewsRows(headers, rows, NOW)
    expect(out[0].score).toBe(10)
  })

  it('normalises 4-star to score 8', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Bob', '4', 'Good', '2025-10-01']],
      NOW,
    )
    expect(out[0].score).toBe(8)
  })

  it('normalises 1-star to score 2', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Carol', '1', 'Bad', '2025-09-01']],
      NOW,
    )
    expect(out[0].score).toBe(2)
  })

  it('returns null score when Star Rating is missing or empty', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Review', 'Date'],
      [['Dave', 'No rating provided', '2025-08-01']],
      NOW,
    )
    expect(out[0].score).toBeNull()
  })
})

describe('Google Reviews adapter — email is always null', () => {
  it('sets email to null regardless of source data', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Great', '2025-11-01']],
      NOW,
    )
    expect(out[0].email).toBeNull()
  })
})

describe('Google Reviews adapter — channel is always "review"', () => {
  it('sets channel to "review"', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Great', '2025-11-01']],
      NOW,
    )
    expect(out[0].channel).toBe('review')
  })
})

describe('Google Reviews adapter — review text as verbatim', () => {
  it('maps Review column to verbatim', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Loved the product', '2025-11-01']],
      NOW,
    )
    expect(out[0].verbatim).toBe('Loved the product')
  })

  it('returns null verbatim when Review column absent', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Date'],
      [['Alice', '5', '2025-11-01']],
      NOW,
    )
    expect(out[0].verbatim).toBeNull()
  })

  it('returns null verbatim when review text is empty', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', '', '2025-11-01']],
      NOW,
    )
    expect(out[0].verbatim).toBeNull()
  })
})

describe('Google Reviews adapter — Review ID for deduplication', () => {
  it('uses Review ID as externalId when present', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date', 'Review ID'],
      [['Alice', '5', 'Great', '2025-11-01', 'GR_abc123']],
      NOW,
    )
    expect(out[0].externalId).toBe('GR_abc123')
  })

  it('returns null externalId when Review ID column absent', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Great', '2025-11-01']],
      NOW,
    )
    expect(out[0].externalId).toBeNull()
  })
})

describe('Google Reviews adapter — date parsing', () => {
  it('parses ISO date correctly', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Great', '2025-06-15']],
      NOW,
    )
    expect(out[0].completedAt.getFullYear()).toBe(2025)
    expect(out[0].completedAt.getMonth()).toBe(5) // June (0-indexed)
  })

  it('defaults to import date when Date column absent', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review'],
      [['Alice', '5', 'Great']],
      NOW,
    )
    expect(out[0].completedAt).toBe(NOW)
  })
})

describe('Google Reviews adapter — reviewer stored in rawAnswers', () => {
  it('stores Reviewer display name in rawAnswers.reviewer_name', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice Smith', '5', 'Great', '2025-11-01']],
      NOW,
    )
    expect(out[0].rawAnswers['reviewer_name']).toBe('Alice Smith')
  })
})

describe('Google Reviews adapter — sourceType', () => {
  it('sets sourceType to "google_reviews" on all rows', () => {
    const { rows: out } = parseGoogleReviewsRows(
      ['Reviewer', 'Star Rating', 'Review', 'Date'],
      [['Alice', '5', 'Great', '2025-11-01']],
      NOW,
    )
    expect(out[0].sourceType).toBe('google_reviews')
  })
})

describe('Google Reviews adapter — multiple rows', () => {
  it('processes all rows independently', () => {
    const headers = ['Reviewer', 'Star Rating', 'Review', 'Date']
    const rows = [
      ['Alice', '5', 'Excellent', '2025-11-01'],
      ['Bob', '2', 'Poor', '2025-10-15'],
      ['Carol', '4', 'Good', '2025-09-20'],
    ]
    const { rows: out, validationErrors } = parseGoogleReviewsRows(headers, rows, NOW)
    expect(validationErrors).toHaveLength(0)
    expect(out).toHaveLength(3)
    expect(out[0].score).toBe(10)
    expect(out[1].score).toBe(4)
    expect(out[2].score).toBe(8)
    out.forEach((row) => expect(row.email).toBeNull())
    out.forEach((row) => expect(row.channel).toBe('review'))
  })
})
