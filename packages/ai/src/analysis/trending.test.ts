import { describe, it, expect } from 'vitest'
import { computeTrend } from './trending.js'

describe('computeTrend', () => {
  it('detects upward trend', () => {
    const result = computeTrend([10, 12, 15, 18], [5, 4, 6, 5])
    expect(result.direction).toBe('up')
    expect(result.changePercent).toBeGreaterThan(100)
  })

  it('detects downward trend', () => {
    const result = computeTrend([2, 1, 1, 0], [10, 12, 15, 18])
    expect(result.direction).toBe('down')
    expect(result.changePercent).toBeLessThan(-50)
  })

  it('detects stable trend', () => {
    const result = computeTrend([5, 5, 6, 5], [5, 5, 5, 5])
    expect(result.direction).toBe('stable')
    expect(Math.abs(result.changePercent)).toBeLessThanOrEqual(15)
  })

  it('handles zero previous volume', () => {
    const result = computeTrend([5, 5], [0, 0])
    expect(result.direction).toBe('up')
    expect(result.changePercent).toBe(100)
  })

  it('handles all zeros', () => {
    const result = computeTrend([0, 0], [0, 0])
    expect(result.direction).toBe('stable')
    expect(result.changePercent).toBe(0)
  })
})
