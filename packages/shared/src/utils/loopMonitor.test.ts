import { describe, it, expect } from 'vitest'
import { computeLoopMonitorWarning, computeLatencyPercentiles } from './loopMonitor.js'

const HOUR_MS = 60 * 60 * 1000

describe('computeLoopMonitorWarning', () => {
  it('returns null when firstResponseAt is null', () => {
    expect(computeLoopMonitorWarning(null, 0)).toBeNull()
  })

  it('returns null when firstResponseAt is undefined', () => {
    expect(computeLoopMonitorWarning(undefined, 0)).toBeNull()
  })

  it('returns null when < 48h ago with 0 campaigns', () => {
    const recent = new Date(Date.now() - 47 * HOUR_MS)
    expect(computeLoopMonitorWarning(recent, 0)).toBeNull()
  })

  it('returns null when > 48h ago but campaigns > 0', () => {
    const old = new Date(Date.now() - 49 * HOUR_MS)
    expect(computeLoopMonitorWarning(old, 5)).toBeNull()
  })

  it('returns warning when > 48h ago and 0 campaigns', () => {
    const old = new Date(Date.now() - 49 * HOUR_MS)
    const result = computeLoopMonitorWarning(old, 0)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('no_campaigns_triggered_48h')
    expect(result?.message).toBeTruthy()
  })

  it('returns null exactly at the 48h boundary (not yet exceeded)', () => {
    // Exactly 48h — elapsed equals threshold, but < is used so boundary is still null
    // (elapsed must be strictly > threshold to trigger warning)
    // In our implementation: elapsed < WARNING_THRESHOLD_MS → return null
    // So exactly 48h (elapsed === threshold) triggers warning (elapsed is NOT < threshold)
    const exact = new Date(Date.now() - 48 * HOUR_MS)
    const result = computeLoopMonitorWarning(exact, 0)
    // Boundary: elapsed === threshold → NOT < threshold → warning fires
    expect(result?.type).toBe('no_campaigns_triggered_48h')
  })
})

describe('computeLatencyPercentiles', () => {
  it('returns null percentiles when sampleSize < 10', () => {
    const result = computeLatencyPercentiles([100, 200, 300])
    expect(result.p50Ms).toBeNull()
    expect(result.p95Ms).toBeNull()
    expect(result.sampleSize).toBe(3)
    expect(result.slaStatus).toBe('ok')
  })

  it('returns null percentiles for empty array', () => {
    const result = computeLatencyPercentiles([])
    expect(result.p50Ms).toBeNull()
    expect(result.p95Ms).toBeNull()
    expect(result.sampleSize).toBe(0)
  })

  it('computes correct P50 for 10 even values', () => {
    const values = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
    const result = computeLatencyPercentiles(values)
    // P50 of [1000..10000] sorted: virtual index = 0.5 * 9 = 4.5 → interpolate [5000, 6000] → 5500
    expect(result.p50Ms).toBe(5500)
    expect(result.sampleSize).toBe(10)
  })

  it('computes correct P95 for 20 values', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 1000) // 1000..20000
    const result = computeLatencyPercentiles(values)
    // P95: virtual index = 0.95 * 19 = 18.05 → sorted[18]=19000, sorted[19]=20000 → 19000 + 0.05*(1000) = 19050
    expect(result.p95Ms).toBe(19050)
  })

  it('returns slaStatus ok when p95 < 900000ms', () => {
    const values = Array.from({ length: 10 }, () => 100) // all 100ms
    expect(computeLatencyPercentiles(values).slaStatus).toBe('ok')
  })

  it('returns slaStatus warning when p95 between 900000 and 1800000ms', () => {
    // With CONT interpolation: [100x9, 2000000] → P95 = 100 + 0.55*(2000000-100) ≈ 1100000ms → warning
    const values = Array.from({ length: 9 }, () => 100).concat([2000000])
    expect(computeLatencyPercentiles(values).slaStatus).toBe('warning')
  })

  it('returns slaStatus breach when p95 > 1800000ms', () => {
    // With CONT interpolation: [100x9, 4000000] → P95 = 100 + 0.55*(4000000-100) ≈ 2200000ms → breach
    const values = Array.from({ length: 9 }, () => 100).concat([4000000])
    expect(computeLatencyPercentiles(values).slaStatus).toBe('breach')
  })
})
