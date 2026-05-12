import { describe, it, expect } from 'vitest'
import { toggleChip } from './filter-chips.logic'

describe('toggleChip — pure helper', () => {
  it('adds the value when absent', () => {
    expect(toggleChip([], 'NPS')).toEqual(['NPS'])
    expect(toggleChip(['CSAT'], 'NPS')).toEqual(['CSAT', 'NPS'])
  })

  it('removes the value when present', () => {
    expect(toggleChip(['NPS'], 'NPS')).toEqual([])
    expect(toggleChip(['NPS', 'CSAT'], 'NPS')).toEqual(['CSAT'])
  })

  it('does not mutate the input array', () => {
    const before = ['NPS']
    const after = toggleChip(before, 'CSAT')
    expect(before).toEqual(['NPS'])
    expect(after).toEqual(['NPS', 'CSAT'])
  })

  it('round-trips: toggle then toggle again restores original membership', () => {
    const initial = ['NPS', 'CSAT']
    const once = toggleChip(initial, 'CES')
    const twice = toggleChip(once, 'CES')
    expect(twice).toEqual(initial)
  })
})
