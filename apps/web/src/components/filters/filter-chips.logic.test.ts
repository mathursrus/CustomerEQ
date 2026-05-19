import { describe, it, expect } from 'vitest'
import { toggleChip, bandChipsForType } from './filter-chips.logic'

describe('toggleChip', () => {
  it('adds a value when absent', () => {
    expect(toggleChip(['a'], 'b')).toEqual(['a', 'b'])
  })
  it('removes a value when present', () => {
    expect(toggleChip(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('handles empty input', () => {
    expect(toggleChip([], 'x')).toEqual(['x'])
  })
})

describe('bandChipsForType', () => {
  it('returns NPS bands in spec order (Promoter, Passive, Detractor)', () => {
    const chips = bandChipsForType('NPS')
    expect(chips.map((c) => c.value)).toEqual(['promoter', 'passive', 'detractor'])
    expect(chips[0].label).toBe('Promoter')
  })
  it('returns CSAT bands (Satisfied, Neutral, Dissatisfied)', () => {
    const chips = bandChipsForType('CSAT')
    expect(chips.map((c) => c.value)).toEqual(['satisfied', 'neutral', 'dissatisfied'])
  })
  it('returns CES bands (Easy, Neutral, Hard)', () => {
    const chips = bandChipsForType('CES')
    expect(chips.map((c) => c.value)).toEqual(['easy', 'neutral', 'hard'])
  })
  it('returns empty array for CUSTOM / unknown types', () => {
    expect(bandChipsForType('CUSTOM')).toEqual([])
    expect(bandChipsForType('OTHER')).toEqual([])
  })
})
