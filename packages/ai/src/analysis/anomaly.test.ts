import { describe, it, expect } from 'vitest'
import { zScore, isVolumeAnomaly } from './anomaly.js'

describe('zScore', () => {
  it('returns 0 for empty series', () => {
    expect(zScore(5, [])).toBe(0)
  })

  it('returns 0 when all values are the same', () => {
    expect(zScore(5, [5, 5, 5, 5])).toBe(0)
  })

  it('returns positive z-score for value above mean', () => {
    const series = [1, 2, 3, 4, 5]
    expect(zScore(10, series)).toBeGreaterThan(2)
  })

  it('returns negative z-score for value below mean', () => {
    const series = [10, 11, 12, 13, 14]
    expect(zScore(1, series)).toBeLessThan(-2)
  })
})

describe('isVolumeAnomaly', () => {
  it('detects anomalous spike', () => {
    const history = [5, 4, 6, 5, 4, 5, 6, 4, 5, 5]
    expect(isVolumeAnomaly(25, history)).toBe(true)
  })

  it('does not flag normal values', () => {
    const history = [5, 4, 6, 5, 4, 5, 6, 4, 5, 5]
    expect(isVolumeAnomaly(6, history)).toBe(false)
  })

  it('respects custom threshold', () => {
    const history = [5, 4, 6, 5, 4, 5, 6, 4, 5, 5]
    expect(isVolumeAnomaly(8, history, 1.0)).toBe(true)
    expect(isVolumeAnomaly(8, history, 5.0)).toBe(false)
  })
})
