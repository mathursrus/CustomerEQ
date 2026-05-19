import { describe, it, expect } from 'vitest'
import { formatInBrandTz, endOfDayInBrandTz, addDaysInBrandTz, resolveLocale } from './datetime.js'

// 15 spike fixtures copied verbatim from docs/evidence/378-tz-spike/spike.mjs.
// These cover DST spring-forward / fall-back (US + NZ), half-hour TZ (IST),
// boundary days (EOD on the DST transition day), and 0/7/90 day presets.
const spikeCases = [
  { now: '2026-05-15T14:00:00Z', addDays: 7,  tz: 'UTC',                 label: 'baseline: UTC, no DST in window' },
  { now: '2026-05-15T21:00:00Z', addDays: 7,  tz: 'America/Los_Angeles', label: 'PT, no DST in window (mid-May → mid-May)' },
  { now: '2026-05-15T05:00:00Z', addDays: 7,  tz: 'Asia/Tokyo',          label: 'JST, no DST (Japan does not observe DST)' },
  { now: '2026-03-05T21:00:00Z', addDays: 7,  tz: 'America/Los_Angeles', label: 'PT, spring-forward inside window' },
  { now: '2026-03-05T21:00:00Z', addDays: 7,  tz: 'America/New_York',    label: 'ET, spring-forward inside window' },
  { now: '2026-10-29T21:00:00Z', addDays: 7,  tz: 'America/Los_Angeles', label: 'PT, fall-back inside window' },
  { now: '2026-10-29T21:00:00Z', addDays: 7,  tz: 'America/New_York',    label: 'ET, fall-back inside window' },
  { now: '2026-04-02T05:00:00Z', addDays: 7,  tz: 'Pacific/Auckland',    label: 'NZ, fall-back inside window' },
  { now: '2026-09-24T05:00:00Z', addDays: 7,  tz: 'Pacific/Auckland',    label: 'NZ, spring-forward inside window' },
  { now: '2026-03-08T07:00:00Z', addDays: 0,  tz: 'America/Los_Angeles', label: 'PT, EOD on DST spring-forward day itself' },
  { now: '2026-11-01T07:00:00Z', addDays: 0,  tz: 'America/Los_Angeles', label: 'PT, EOD on DST fall-back day itself' },
  { now: '2026-05-15T21:00:00Z', addDays: 0,  tz: 'America/Los_Angeles', label: 'PT, today EOD (N=0)' },
  { now: '2026-05-15T07:00:00Z', addDays: 7,  tz: 'Asia/Kolkata',        label: 'IST (+05:30), no DST' },
  { now: '2026-05-15T21:00:00Z', addDays: 90, tz: 'America/Los_Angeles', label: 'PT, 90-day preset entirely in PDT' },
  { now: '2026-08-15T20:00:00Z', addDays: 90, tz: 'America/Los_Angeles', label: 'PT, 90-day preset crossing fall-back' },
] as const

function wallClock(date: Date, tz: string): string {
  // 24-hour wall-clock formatted in the target TZ — used to assert that the
  // returned UTC instant displays as 23:59:59 in the brand TZ regardless of
  // DST offset at the target wall-clock instant.
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return fmt.format(date)
}

describe('endOfDayInBrandTz + addDaysInBrandTz (15 spike cases)', () => {
  it.each(spikeCases)('$label', ({ now, addDays: days, tz }) => {
    const target = addDaysInBrandTz(new Date(now), days, tz)
    const eod = endOfDayInBrandTz(target, tz)
    // The returned UTC instant must read 23:59:59 wall-clock in the brand TZ.
    expect(wallClock(eod, tz)).toMatch(/, 23:59:59$/)
  })
})

describe('endOfDayInBrandTz — exact UTC outputs (regression fixtures)', () => {
  it('PT spring-forward window: 2026-03-05 +7d → 2026-03-13T06:59:59.999Z', () => {
    const target = addDaysInBrandTz(new Date('2026-03-05T21:00:00Z'), 7, 'America/Los_Angeles')
    const eod = endOfDayInBrandTz(target, 'America/Los_Angeles')
    expect(eod.toISOString()).toBe('2026-03-13T06:59:59.999Z')
  })

  it('PT fall-back window: 2026-10-29 +7d → 2026-11-06T07:59:59.999Z', () => {
    const target = addDaysInBrandTz(new Date('2026-10-29T21:00:00Z'), 7, 'America/Los_Angeles')
    const eod = endOfDayInBrandTz(target, 'America/Los_Angeles')
    expect(eod.toISOString()).toBe('2026-11-06T07:59:59.999Z')
  })

  it('IST half-hour: 2026-05-15 +7d → 2026-05-22T18:29:59.999Z', () => {
    const target = addDaysInBrandTz(new Date('2026-05-15T07:00:00Z'), 7, 'Asia/Kolkata')
    const eod = endOfDayInBrandTz(target, 'Asia/Kolkata')
    expect(eod.toISOString()).toBe('2026-05-22T18:29:59.999Z')
  })

  it('UTC baseline: 2026-05-15 +7d → 2026-05-22T23:59:59.999Z', () => {
    const target = addDaysInBrandTz(new Date('2026-05-15T14:00:00Z'), 7, 'UTC')
    const eod = endOfDayInBrandTz(target, 'UTC')
    expect(eod.toISOString()).toBe('2026-05-22T23:59:59.999Z')
  })
})

describe('formatInBrandTz', () => {
  const instant = new Date('2026-05-22T18:29:59.999Z') // displays as 11:59:59 PM IST or 11:29:59 AM PT

  it('formats a UTC instant in brand TZ + locale', () => {
    const formatted = formatInBrandTz(instant, 'America/Los_Angeles', 'en-US', 'yyyy-MM-dd HH:mm:ss zzz')
    expect(formatted).toBe('2026-05-22 11:29:59 PDT')
  })

  it('honors brand locale for month/day names', () => {
    const formatted = formatInBrandTz(instant, 'America/Los_Angeles', 'fr-FR', 'd MMMM yyyy')
    expect(formatted).toBe('22 mai 2026')
  })

  it('accepts ISO string input as well as Date', () => {
    const a = formatInBrandTz(instant, 'UTC', 'en-US', 'HH:mm:ss')
    const b = formatInBrandTz(instant.toISOString(), 'UTC', 'en-US', 'HH:mm:ss')
    expect(a).toBe(b)
    expect(a).toBe('18:29:59')
  })

  it('falls back to enUS for unknown locale', () => {
    const formatted = formatInBrandTz(instant, 'UTC', 'xx-XX', 'MMMM')
    expect(formatted).toBe('May')
  })
})

describe('resolveLocale', () => {
  it('returns a locale with matching code for known BCP-47 strings', () => {
    expect(resolveLocale('en-US').code).toBe('en-US')
    expect(resolveLocale('en-GB').code).toBe('en-GB')
    expect(resolveLocale('fr-FR').code).toBe('fr')
  })

  it('falls back to enUS for unknown / null / empty inputs', () => {
    expect(resolveLocale(undefined).code).toBe('en-US')
    expect(resolveLocale(null).code).toBe('en-US')
    expect(resolveLocale('').code).toBe('en-US')
    expect(resolveLocale('xx-XX').code).toBe('en-US')
  })
})
