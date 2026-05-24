// Issue #420 — survey-send suppression derivation tests.
// Verifies the resolution-order contract (erased → email → consent →
// unsubscribed) and that emailOptIn is intentionally NOT consulted per R44.

import { describe, it, expect } from 'vitest'

import {
  deriveSurveySuppression,
  suppressionChipLabel,
  suppressionTooltip,
} from './distributionSuppression.js'

const base = {
  erased: false,
  email: 'alice@example.com',
  consentGivenAt: new Date('2026-01-01T00:00:00Z'),
  unsubscribedSurveysAt: null,
}

describe('deriveSurveySuppression', () => {
  it('returns OK when all four R44 conditions are satisfied', () => {
    expect(deriveSurveySuppression(base)).toEqual({ status: 'OK', since: null })
  })

  it('returns ERASED when erased = true (earliest disqualifier wins)', () => {
    expect(
      deriveSurveySuppression({ ...base, erased: true, email: null, consentGivenAt: null }),
    ).toEqual({ status: 'ERASED', since: null })
  })

  it('returns NO_EMAIL when email is null but member is not erased', () => {
    expect(deriveSurveySuppression({ ...base, email: null })).toEqual({
      status: 'NO_EMAIL',
      since: null,
    })
  })

  it('returns NO_CONSENT when consentGivenAt is null', () => {
    expect(deriveSurveySuppression({ ...base, consentGivenAt: null })).toEqual({
      status: 'NO_CONSENT',
      since: null,
    })
  })

  it('returns UNSUBSCRIBED with the ISO since timestamp', () => {
    const since = new Date('2026-04-12T15:00:00Z')
    expect(
      deriveSurveySuppression({ ...base, unsubscribedSurveysAt: since }),
    ).toEqual({ status: 'UNSUBSCRIBED', since: since.toISOString() })
  })

  it('accepts string inputs for the timestamp fields', () => {
    const isoConsent = '2026-01-01T00:00:00.000Z'
    const isoUnsub = '2026-04-12T00:00:00.000Z'
    expect(
      deriveSurveySuppression({
        erased: false,
        email: 'a@b.com',
        consentGivenAt: isoConsent,
        unsubscribedSurveysAt: isoUnsub,
      }),
    ).toEqual({ status: 'UNSUBSCRIBED', since: isoUnsub })
  })
})

describe('suppressionChipLabel', () => {
  it('formats the UNSUBSCRIBED label with the date slice', () => {
    expect(
      suppressionChipLabel({ status: 'UNSUBSCRIBED', since: '2026-04-12T15:00:00.000Z' }),
    ).toBe('Unsubscribed · 2026-04-12')
  })

  it('falls back to the bare label when since is null', () => {
    expect(suppressionChipLabel({ status: 'UNSUBSCRIBED', since: null })).toBe(
      'Unsubscribed',
    )
  })
})

describe('suppressionTooltip', () => {
  it('renders the unsubscribed tooltip with the date', () => {
    const tip = suppressionTooltip(
      { firstName: 'Hannah', lastName: 'Mehta' },
      { status: 'UNSUBSCRIBED', since: '2026-04-12T15:00:00.000Z' },
    )
    expect(tip).toContain('Hannah Mehta')
    expect(tip).toContain('2026-04-12')
  })

  it('mentions consentGivenAt + emailOptIn distinction for NO_CONSENT', () => {
    const tip = suppressionTooltip(
      { firstName: 'Ivan', lastName: 'Rao' },
      { status: 'NO_CONSENT', since: null },
    )
    expect(tip).toContain('consentGivenAt')
    expect(tip).toContain('emailOptIn')
  })

  it('returns empty string for OK', () => {
    expect(suppressionTooltip({}, { status: 'OK', since: null })).toBe('')
  })
})
