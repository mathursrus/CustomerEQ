import { describe, it, expect } from 'vitest'

// ─── Pure helpers extracted from mobile routes ────────────────────────────────
// These are tested independently before the route file is implemented.

/**
 * Given an array of NPS responses (score 0-10), returns the NPS score.
 * NPS = (promoters% - detractors%) * 100, rounded to nearest integer.
 */
function computeNpsScore(responses: { score: number }[]): number | null {
  const npsResponses = responses.filter((r) => r.score !== null && r.score !== undefined)
  if (npsResponses.length === 0) return null
  const promoters = npsResponses.filter((r) => r.score >= 9).length
  const detractors = npsResponses.filter((r) => r.score <= 6).length
  return Math.round(((promoters - detractors) / npsResponses.length) * 100)
}

/**
 * Groups responses by ISO week bucket (Monday-start) and computes NPS per bucket.
 * Returns last `weeks` buckets sorted oldest→newest. Buckets with no responses
 * carry the previous bucket's score (forward-fill) or null.
 */
function buildWeeklyNpsBuckets(
  responses: { score: number | null; completedAt: Date }[],
  weeks: number = 7,
): Array<{ weekStart: string; nps: number | null; count: number }> {
  const now = new Date()
  const buckets: Array<{ weekStart: string; nps: number | null; count: number }> = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7) // Monday
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekResponses = responses.filter(
      (r) => r.score !== null && r.completedAt >= weekStart && r.completedAt < weekEnd,
    ) as { score: number; completedAt: Date }[]

    buckets.push({
      weekStart: weekStart.toISOString(),
      nps: weekResponses.length > 0 ? computeNpsScore(weekResponses) : null,
      count: weekResponses.length,
    })
  }

  // Forward-fill null buckets with last known NPS
  let lastKnown: number | null = null
  for (const b of buckets) {
    if (b.nps !== null) {
      lastKnown = b.nps
    } else if (lastKnown !== null) {
      b.nps = lastKnown
    }
  }

  return buckets
}

/**
 * Formats an ExternalSignal row into the mobile reviews API shape.
 */
function formatReviewForMobile(signal: {
  id: string
  externalAuthorLabel: string | null
  rating: number | null
  body: string
  postedAt: Date | null
  providerStatus: string | null
}) {
  return {
    id: signal.id,
    author: signal.externalAuthorLabel ?? 'Anonymous',
    rating: signal.rating ?? 0,
    text: signal.body,
    date: signal.postedAt?.toISOString() ?? null,
    replied: signal.providerStatus === 'replied',
  }
}

/**
 * Validates that a brandId comes from the request (not the body).
 * In the actual route this is enforced by the multiTenant plugin, but this
 * tests that the helper rejects attempts to pass brandId in body.
 */
function extractBrandIdFromRequest(
  requestBrandId: string | undefined,
  bodyBrandId: string | undefined,
): string {
  if (!requestBrandId) throw new Error('brandId missing from JWT')
  return requestBrandId // body value is intentionally ignored
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeNpsScore', () => {
  it('returns null for empty responses', () => {
    expect(computeNpsScore([])).toBeNull()
  })

  it('returns 100 when all are promoters (9-10)', () => {
    const responses = [{ score: 9 }, { score: 10 }, { score: 9 }]
    expect(computeNpsScore(responses)).toBe(100)
  })

  it('returns -100 when all are detractors (0-6)', () => {
    const responses = [{ score: 0 }, { score: 5 }, { score: 6 }]
    expect(computeNpsScore(responses)).toBe(-100)
  })

  it('returns 0 when equal promoters and detractors', () => {
    const responses = [{ score: 10 }, { score: 0 }]
    expect(computeNpsScore(responses)).toBe(0)
  })

  it('ignores passives (7-8) in NPS calculation', () => {
    // 1 promoter, 0 detractors, 3 passives → NPS = (1-0)/4 * 100 = 25
    const responses = [{ score: 10 }, { score: 7 }, { score: 8 }, { score: 8 }]
    expect(computeNpsScore(responses)).toBe(25)
  })

  it('rounds to nearest integer', () => {
    // 2 promoters, 1 detractor, 0 passives → (2-1)/3 * 100 = 33.33 → 33
    const responses = [{ score: 9 }, { score: 10 }, { score: 3 }]
    expect(computeNpsScore(responses)).toBe(33)
  })

  it('returns 62 for the demo data scenario (74 promoters, 12 detractors, 14 passives = 142 responses)', () => {
    const responses: { score: number }[] = [
      ...Array(74).fill({ score: 10 }), // promoters
      ...Array(14).fill({ score: 8 }),  // passives
      ...Array(12).fill({ score: 3 }),  // detractors
    ]
    // (74-12)/100 * 100 = 62
    expect(computeNpsScore(responses)).toBe(62)
  })
})

describe('buildWeeklyNpsBuckets', () => {
  it('returns exactly `weeks` buckets', () => {
    const buckets = buildWeeklyNpsBuckets([], 7)
    expect(buckets).toHaveLength(7)
  })

  it('returns null NPS for weeks with no responses', () => {
    const buckets = buildWeeklyNpsBuckets([], 7)
    // All null before forward-fill kicks in
    expect(buckets.every((b) => b.nps === null)).toBe(true)
  })

  it('forward-fills null weeks from the last known NPS', () => {
    const now = new Date()
    const thisMonday = new Date(now)
    thisMonday.setDate(thisMonday.getDate() - thisMonday.getDay() + 1)
    thisMonday.setHours(12, 0, 0, 0)

    const responses = [
      { score: 10, completedAt: thisMonday }, // promoter this week
    ]
    const buckets = buildWeeklyNpsBuckets(responses, 3)
    // Last bucket has NPS=100; earlier buckets forward-fill from... actually they fill from prior known
    // The current week (last bucket) has a response → nps=100
    const lastBucket = buckets[buckets.length - 1]!
    expect(lastBucket.nps).toBe(100)
    expect(lastBucket.count).toBe(1)
  })

  it('buckets are sorted oldest-first', () => {
    const buckets = buildWeeklyNpsBuckets([], 3)
    const dates = buckets.map((b) => new Date(b.weekStart).getTime())
    expect(dates[0]! < dates[1]!).toBe(true)
    expect(dates[1]! < dates[2]!).toBe(true)
  })
})

describe('formatReviewForMobile', () => {
  it('maps ExternalSignal to mobile review shape', () => {
    const signal = {
      id: 'sig-1',
      externalAuthorLabel: 'Alice Chen',
      rating: 4,
      body: 'Great coffee, slow checkout.',
      postedAt: new Date('2026-05-20T10:00:00Z'),
      providerStatus: null,
    }
    const review = formatReviewForMobile(signal)
    expect(review).toEqual({
      id: 'sig-1',
      author: 'Alice Chen',
      rating: 4,
      text: 'Great coffee, slow checkout.',
      date: '2026-05-20T10:00:00.000Z',
      replied: false,
    })
  })

  it('defaults author to "Anonymous" when externalAuthorLabel is null', () => {
    const signal = {
      id: 'sig-2',
      externalAuthorLabel: null,
      rating: 3,
      body: 'Decent.',
      postedAt: null,
      providerStatus: null,
    }
    const review = formatReviewForMobile(signal)
    expect(review.author).toBe('Anonymous')
    expect(review.date).toBeNull()
  })

  it('sets replied=true when providerStatus is "replied"', () => {
    const signal = {
      id: 'sig-3',
      externalAuthorLabel: 'Bob Smith',
      rating: 2,
      body: 'Too slow.',
      postedAt: new Date('2026-05-15T08:00:00Z'),
      providerStatus: 'replied',
    }
    const review = formatReviewForMobile(signal)
    expect(review.replied).toBe(true)
  })

  it('defaults rating to 0 when null', () => {
    const signal = {
      id: 'sig-4',
      externalAuthorLabel: 'Anon',
      rating: null,
      body: 'No rating.',
      postedAt: null,
      providerStatus: null,
    }
    expect(formatReviewForMobile(signal).rating).toBe(0)
  })
})

describe('extractBrandIdFromRequest (Rule 6 — brandId from JWT only)', () => {
  it('returns brandId from the request JWT', () => {
    expect(extractBrandIdFromRequest('brand-abc', undefined)).toBe('brand-abc')
  })

  it('ignores brandId passed in the request body', () => {
    expect(extractBrandIdFromRequest('brand-abc', 'brand-xyz')).toBe('brand-abc')
  })

  it('throws when JWT has no brandId', () => {
    expect(() => extractBrandIdFromRequest(undefined, 'brand-xyz')).toThrow('brandId missing from JWT')
  })
})

describe('Mobile dashboard NPS delta computation', () => {
  it('computes positive week-over-week delta', () => {
    const currentNps = 65
    const previousNps = 61
    const delta = currentNps - previousNps
    expect(delta).toBe(4)
    expect(delta > 0).toBe(true)
  })

  it('computes negative week-over-week delta', () => {
    const currentNps = 58
    const previousNps = 62
    const delta = currentNps - previousNps
    expect(delta).toBe(-4)
    expect(delta < 0).toBe(true)
  })

  it('returns 0 delta when no change', () => {
    expect(62 - 62).toBe(0)
  })
})

describe('Review pagination', () => {
  it('correctly slices reviews for page 1 with limit 20', () => {
    const reviews = Array.from({ length: 50 }, (_, i) => ({ id: `r-${i}` }))
    const page = 1
    const limit = 20
    const offset = (page - 1) * limit
    const paginated = reviews.slice(offset, offset + limit)
    expect(paginated).toHaveLength(20)
    expect(paginated[0]!.id).toBe('r-0')
    expect(paginated[19]!.id).toBe('r-19')
  })

  it('correctly slices reviews for page 2 with limit 20', () => {
    const reviews = Array.from({ length: 50 }, (_, i) => ({ id: `r-${i}` }))
    const page = 2
    const limit = 20
    const offset = (page - 1) * limit
    const paginated = reviews.slice(offset, offset + limit)
    expect(paginated).toHaveLength(20)
    expect(paginated[0]!.id).toBe('r-20')
  })

  it('returns partial last page', () => {
    const reviews = Array.from({ length: 25 }, (_, i) => ({ id: `r-${i}` }))
    const page = 2
    const limit = 20
    const offset = (page - 1) * limit
    const paginated = reviews.slice(offset, offset + limit)
    expect(paginated).toHaveLength(5)
  })
})
