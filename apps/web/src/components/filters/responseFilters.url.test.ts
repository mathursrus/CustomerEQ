import { describe, it, expect } from 'vitest'
import { encodeFiltersToQs, decodeFiltersFromQs } from './responseFilters.url'

describe('encodeFiltersToQs', () => {
  it('omits the default wave="all"', () => {
    expect(encodeFiltersToQs({ wave: 'all' })).toBe('')
  })
  it('emits explicit values as comma-separated lists', () => {
    const qs = encodeFiltersToQs({
      wave: 'all',
      scoreBands: ['detractor', 'passive'],
      channels: ['email', 'sms'],
      submittedFrom: '2026-04-15',
      submittedTo: '2026-04-22',
    })
    const params = new URLSearchParams(qs)
    expect(params.get('scoreBands')).toBe('detractor,passive')
    expect(params.get('channels')).toBe('email,sms')
    expect(params.get('submittedFrom')).toBe('2026-04-15')
    expect(params.get('submittedTo')).toBe('2026-04-22')
  })
  it('preserves wave="direct"', () => {
    const qs = encodeFiltersToQs({ wave: 'direct' })
    expect(qs).toContain('wave=direct')
  })
})

describe('decodeFiltersFromQs', () => {
  it('round-trips encoded filters', () => {
    const original = {
      wave: 'all' as const,
      scoreBands: ['promoter', 'detractor'] as const,
      sentimentBands: ['positive'] as const,
      channels: ['email'],
      submittedFrom: '2026-04-15',
      submittedTo: '2026-04-22',
    }
    const qs = encodeFiltersToQs(original)
    const decoded = decodeFiltersFromQs(new URLSearchParams(qs))
    expect(decoded.scoreBands).toEqual(['promoter', 'detractor'])
    expect(decoded.sentimentBands).toEqual(['positive'])
    expect(decoded.channels).toEqual(['email'])
    expect(decoded.submittedFrom).toBe('2026-04-15')
    expect(decoded.submittedTo).toBe('2026-04-22')
  })
  it('silently drops unknown score-band values to defaults', () => {
    const decoded = decodeFiltersFromQs(new URLSearchParams('scoreBands=unknownband'))
    expect(decoded.wave).toBe('all')
  })
  it('falls back to wave="all" for missing/empty query', () => {
    const decoded = decodeFiltersFromQs(new URLSearchParams(''))
    expect(decoded.wave).toBe('all')
  })
})
