import { describe, it, expect } from 'vitest'

// Test the ROI formula and analytics calculation logic

function calculateROI(totalPointsIssued: number, totalPointsRedeemed: number, ratio: number): number {
  if (totalPointsIssued === 0) return 0
  const issuedValue = totalPointsIssued * ratio
  const redeemedValue = totalPointsRedeemed * ratio
  return (redeemedValue / issuedValue) * 100
}

describe('Analytics ROI Formula', () => {
  it('returns 0 when no points have been issued', () => {
    expect(calculateROI(0, 0, 0.01)).toBe(0)
  })

  it('returns 0 when no points have been redeemed', () => {
    expect(calculateROI(10000, 0, 0.01)).toBe(0)
  })

  it('returns 100 when all issued points are redeemed', () => {
    expect(calculateROI(10000, 10000, 0.01)).toBe(100)
  })

  it('returns 50 when half of issued points are redeemed', () => {
    expect(calculateROI(10000, 5000, 0.01)).toBe(50)
  })

  it('is ratio-independent (only relative counts matter)', () => {
    const roi1 = calculateROI(1000, 250, 0.01)
    const roi2 = calculateROI(1000, 250, 0.05)
    expect(roi1).toBeCloseTo(roi2, 5)
  })

  it('handles large point values without overflow', () => {
    const roi = calculateROI(1_000_000, 750_000, 0.01)
    expect(roi).toBeCloseTo(75, 5)
  })
})

describe('Analytics date range filtering', () => {
  it('correctly identifies events within range', () => {
    const startDate = new Date('2026-03-01')
    const endDate = new Date('2026-03-31')

    const events = [
      { createdAt: new Date('2026-02-28'), points: 100 }, // before range
      { createdAt: new Date('2026-03-15'), points: 200 }, // in range
      { createdAt: new Date('2026-04-01'), points: 300 }, // after range
    ]

    const inRange = events.filter((e) => e.createdAt >= startDate && e.createdAt <= endDate)
    expect(inRange).toHaveLength(1)
    expect(inRange[0]!.points).toBe(200)
  })

  it('includes events on range boundary dates', () => {
    const startDate = new Date('2026-03-01')
    const endDate = new Date('2026-03-31')

    const events = [
      { createdAt: new Date('2026-03-01'), points: 100 }, // on start boundary
      { createdAt: new Date('2026-03-31'), points: 200 }, // on end boundary
    ]

    const inRange = events.filter((e) => e.createdAt >= startDate && e.createdAt <= endDate)
    expect(inRange).toHaveLength(2)
  })
})

describe('Analytics totalPointsIssued vs totalPointsRedeemed', () => {
  it('correctly separates positive (issued) from negative (redeemed) loyalty events', () => {
    const events = [
      { pointsEarned: 500 },  // earn
      { pointsEarned: 200 },  // earn
      { pointsEarned: -300 }, // redeem
      { pointsEarned: -100 }, // redeem
    ]

    const totalIssued = events.filter((e) => e.pointsEarned > 0).reduce((sum, e) => sum + e.pointsEarned, 0)
    const totalRedeemed = events.filter((e) => e.pointsEarned < 0).reduce((sum, e) => sum + Math.abs(e.pointsEarned), 0)

    expect(totalIssued).toBe(700)
    expect(totalRedeemed).toBe(400)
  })
})
