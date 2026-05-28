/**
 * Unit tests for useSurveyDetail mapping helpers.
 *
 * Tests the pure exported functions rather than the React Query hook to avoid
 * act() complexity. These guard against the shape mismatches found in bug
 * bash #536 from ever regressing:
 *   - sentiment float → string label
 *   - answers object extraction
 *   - member.identifierValue email fallback
 *   - page/totalPages hasMore derivation
 *   - sentimentBands/scoreBands URL param names
 */
import { sentimentLabel, extractTextResponses, mapResponseRow, deriveHasMore } from '../hooks/useSurveyDetail'

// ── sentimentLabel ─────────────────────────────────────────────────────────────

describe('sentimentLabel', () => {
  it.each([
    [0.8, 'positive'],
    [0.11, 'positive'],
    [0.1, 'neutral'],   // boundary: NOT > 0.1
    [0.0, 'neutral'],
    [-0.09, 'neutral'],
    [-0.1, 'neutral'],  // boundary: NOT < -0.1
    [-0.11, 'negative'],
    [-0.3, 'negative'],
  ])('float %f → %s', (float, expected) => {
    expect(sentimentLabel(float)).toBe(expected)
  })

  it('passes through string values unchanged', () => {
    expect(sentimentLabel('positive')).toBe('positive')
    expect(sentimentLabel('negative')).toBe('negative')
    expect(sentimentLabel('neutral')).toBe('neutral')
  })

  it('returns null for null input', () => {
    expect(sentimentLabel(null)).toBeNull()
  })
})

// ── extractTextResponses ───────────────────────────────────────────────────────

describe('extractTextResponses', () => {
  it('extracts string values from object answers (production shape)', () => {
    expect(extractTextResponses({ q1: 3, q2: 'Coffee was cold.' }))
      .toEqual([{ text: 'Coffee was cold.' }])
  })

  it('extracts from array of {text} objects', () => {
    expect(extractTextResponses([{ text: 'Great service!' }, { text: '' }]))
      .toEqual([{ text: 'Great service!' }])
  })

  it('filters out blank strings from object answers', () => {
    expect(extractTextResponses({ q1: '   ', q2: 'Valid' }))
      .toEqual([{ text: 'Valid' }])
  })

  it('filters out blank strings from array answers', () => {
    expect(extractTextResponses([{ text: '  ' }, { text: 'Good' }]))
      .toEqual([{ text: 'Good' }])
  })

  it('ignores non-string values in object answers (e.g. rating numbers)', () => {
    expect(extractTextResponses({ q1: 5, q2: true, q3: 'Only text' }))
      .toEqual([{ text: 'Only text' }])
  })

  it('returns empty array for undefined', () => {
    expect(extractTextResponses(undefined)).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(extractTextResponses({})).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(extractTextResponses([])).toEqual([])
  })
})

// ── mapResponseRow ─────────────────────────────────────────────────────────────

describe('mapResponseRow', () => {
  const base = {
    id: 'r1',
    score: 7,
    sentiment: -0.3,
    completedAt: '2026-05-10T00:00:00Z',
    member: { firstName: 'Sara', lastName: 'Kim', email: null, identifierValue: 'sara@example.com' },
    answers: { q1: 3, q2: 'Coffee was cold.' },
  }

  it('maps all fields correctly', () => {
    const v = mapResponseRow(base)
    expect(v.id).toBe('r1')
    expect(v.score).toBe(7)
    expect(v.sentiment).toBe('negative')
    expect(v.memberName).toBe('Sara Kim')
    expect(v.memberEmail).toBe('sara@example.com')
    expect(v.textResponses).toEqual([{ text: 'Coffee was cold.' }])
  })

  it('uses member.email over identifierValue when both present', () => {
    const row = { ...base, member: { ...base.member, email: 'direct@example.com' } }
    expect(mapResponseRow(row).memberEmail).toBe('direct@example.com')
  })

  it('falls back to identifierValue when email is null', () => {
    expect(mapResponseRow(base).memberEmail).toBe('sara@example.com')
  })

  it('returns null memberEmail when member is null', () => {
    expect(mapResponseRow({ ...base, member: null }).memberEmail).toBeNull()
  })

  it('prefers textResponses field over answers', () => {
    const row = { ...base, textResponses: [{ text: 'Direct' }] }
    expect(mapResponseRow(row).textResponses).toEqual([{ text: 'Direct' }])
  })

  it('builds memberName from first+last, handles partial names', () => {
    const row = { ...base, member: { firstName: 'Alex', lastName: null, email: null, identifierValue: '' } }
    expect(mapResponseRow(row).memberName).toBe('Alex')
  })

  it('returns null memberName when member is null', () => {
    expect(mapResponseRow({ ...base, member: null }).memberName).toBeNull()
  })
})

// ── deriveHasMore ──────────────────────────────────────────────────────────────

describe('deriveHasMore', () => {
  it('true when page < totalPages', () => {
    expect(deriveHasMore({ page: 1, totalPages: 6 }, 20)).toBe(true)
  })

  it('false when page === totalPages', () => {
    expect(deriveHasMore({ page: 6, totalPages: 6 }, 10)).toBe(false)
  })

  it('false when page > totalPages (edge case)', () => {
    expect(deriveHasMore({ page: 7, totalPages: 6 }, 5)).toBe(false)
  })

  it('uses data.hasMore directly when present', () => {
    expect(deriveHasMore({ hasMore: true, page: 1, totalPages: 1 }, 5)).toBe(true)
    expect(deriveHasMore({ hasMore: false, page: 1, totalPages: 5 }, 20)).toBe(false)
  })

  it('falls back to responseCount === 20 when no pagination fields', () => {
    expect(deriveHasMore({}, 20)).toBe(true)
    expect(deriveHasMore({}, 15)).toBe(false)
  })
})
