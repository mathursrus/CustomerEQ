import { describe, it, expect } from 'vitest'
import { STATUS_GROUP, TYPE_GROUP, TYPE_PILL, relTime } from './list-page.logic'

// Issue #241 Slice 3 — phase-3 catch-up tests.
// Asserts spec §1 compliance for the filter chips and exercises the relTime
// helper used in the Updated column.

describe('STATUS_GROUP — spec §1 filter chips', () => {
  it('omits PAUSED (per spec: All / Draft / Active / Stopped — Paused reachable via "All")', () => {
    const values = STATUS_GROUP.options.map((o) => o.value)
    expect(values).not.toContain('PAUSED')
  })

  it('omits the post-rename ghost value CLOSED (Slice 1 renamed CLOSED → STOPPED)', () => {
    const values = STATUS_GROUP.options.map((o) => o.value)
    expect(values).not.toContain('CLOSED')
  })

  it('includes exactly DRAFT, ACTIVE, STOPPED in that order', () => {
    expect(STATUS_GROUP.options.map((o) => o.value)).toEqual(['DRAFT', 'ACTIVE', 'STOPPED'])
  })

  it('labels render with sentence-case (Draft / Active / Stopped)', () => {
    expect(STATUS_GROUP.options.map((o) => o.label)).toEqual(['Draft', 'Active', 'Stopped'])
  })

  it('uses key "status" so URL round-trip lands on ?status=', () => {
    expect(STATUS_GROUP.key).toBe('status')
  })
})

describe('TYPE_GROUP — spec §1 filter chips', () => {
  it('includes all four survey types (NPS / CSAT / CES / CUSTOM)', () => {
    expect(TYPE_GROUP.options.map((o) => o.value).sort()).toEqual(['CES', 'CSAT', 'CUSTOM', 'NPS'])
  })

  it('renders CUSTOM with label "Custom" (sentence-cased; spec §1)', () => {
    const custom = TYPE_GROUP.options.find((o) => o.value === 'CUSTOM')
    expect(custom?.label).toBe('Custom')
  })

  it('does not include legacy categories like Trigger or Distribution', () => {
    const labels = TYPE_GROUP.options.map((o) => o.label.toLowerCase())
    expect(labels).not.toContain('trigger')
    expect(labels).not.toContain('distribution')
  })

  it('uses key "type" so URL round-trip lands on ?type=', () => {
    expect(TYPE_GROUP.key).toBe('type')
  })
})

describe('TYPE_PILL — colour map', () => {
  it('has an entry for each survey type', () => {
    for (const t of ['NPS', 'CSAT', 'CES', 'CUSTOM']) {
      expect(TYPE_PILL[t]).toBeDefined()
    }
  })
})

describe('relTime — Updated column helper', () => {
  // Use a fixed reference clock so tests don't depend on the system clock.
  const now = new Date('2026-05-12T12:00:00Z')

  it('returns "just now" for < 1 minute', () => {
    expect(relTime(new Date('2026-05-12T11:59:31Z').toISOString(), now)).toBe('just now')
  })

  it('returns minutes ago for < 1 hour', () => {
    expect(relTime(new Date('2026-05-12T11:30:00Z').toISOString(), now)).toBe('30m ago')
  })

  it('returns hours ago for < 1 day', () => {
    expect(relTime(new Date('2026-05-12T07:00:00Z').toISOString(), now)).toBe('5h ago')
  })

  it('returns days ago for < 30 days', () => {
    expect(relTime(new Date('2026-05-09T12:00:00Z').toISOString(), now)).toBe('3d ago')
  })

  it('falls back to a locale date for > 30 days', () => {
    const out = relTime(new Date('2026-03-01T12:00:00Z').toISOString(), now)
    // Don't assert exact format (locale-sensitive) — assert it's NOT one of the relative forms.
    expect(out).not.toMatch(/(just now|m ago|h ago|d ago)$/)
  })

  it('exactly 1 minute returns 1m ago (boundary)', () => {
    expect(relTime(new Date('2026-05-12T11:59:00Z').toISOString(), now)).toBe('1m ago')
  })

  it('exactly 1 hour returns 1h ago (boundary)', () => {
    expect(relTime(new Date('2026-05-12T11:00:00Z').toISOString(), now)).toBe('1h ago')
  })
})
