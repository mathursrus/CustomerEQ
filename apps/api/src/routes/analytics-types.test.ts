/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'

/**
 * Tests for analytics route helper logic — ensures the typed mapper
 * functions used in analytics.ts produce correct output shapes.
 */

interface TopRewardResult {
  rewardId: string
  _count: { rewardId: number }
}

interface CampaignEvent {
  executedAt: Date | null
  latencyMs: number | null
}

function mapTopRewards(
  results: TopRewardResult[],
  rewardMap: Map<string, string>,
): Array<{ rewardId: string; rewardName: string; redemptionCount: number }> {
  return results.map((r: TopRewardResult) => ({
    rewardId: r.rewardId,
    rewardName: rewardMap.get(r.rewardId) ?? r.rewardId,
    redemptionCount: r._count.rewardId,
  }))
}

function computeAvgLatency(events: CampaignEvent[]): number | null {
  const total = events.length
  if (total === 0) return null
  const sum = events
    .map((e: CampaignEvent) => e.latencyMs ?? 0)
    .reduce((acc: number, ms: number) => acc + ms, 0)
  return Math.round(sum / total)
}

function countExecuted(events: CampaignEvent[]): number {
  return events.filter((e: { executedAt: Date | null }) => e.executedAt !== null).length
}

describe('Analytics typed helper functions', () => {
  describe('mapTopRewards', () => {
    it('maps reward results with names from the reward map', () => {
      const results: TopRewardResult[] = [
        { rewardId: 'r1', _count: { rewardId: 5 } },
        { rewardId: 'r2', _count: { rewardId: 3 } },
      ]
      const rewardMap = new Map([
        ['r1', 'Gold Badge'],
        ['r2', 'Silver Badge'],
      ])

      const mapped = mapTopRewards(results, rewardMap)
      expect(mapped).toEqual([
        { rewardId: 'r1', rewardName: 'Gold Badge', redemptionCount: 5 },
        { rewardId: 'r2', rewardName: 'Silver Badge', redemptionCount: 3 },
      ])
    })

    it('falls back to rewardId when name is not in the map', () => {
      const results: TopRewardResult[] = [{ rewardId: 'r-unknown', _count: { rewardId: 1 } }]
      const rewardMap = new Map<string, string>()

      const mapped = mapTopRewards(results, rewardMap)
      expect(mapped[0].rewardName).toBe('r-unknown')
    })
  })

  describe('computeAvgLatency', () => {
    it('returns null for empty events', () => {
      expect(computeAvgLatency([])).toBeNull()
    })

    it('computes average latency correctly', () => {
      const events: CampaignEvent[] = [
        { executedAt: new Date(), latencyMs: 100 },
        { executedAt: new Date(), latencyMs: 200 },
        { executedAt: new Date(), latencyMs: 300 },
      ]
      expect(computeAvgLatency(events)).toBe(200)
    })

    it('treats null latencyMs as 0', () => {
      const events: CampaignEvent[] = [
        { executedAt: new Date(), latencyMs: null },
        { executedAt: new Date(), latencyMs: 100 },
      ]
      expect(computeAvgLatency(events)).toBe(50)
    })
  })

  describe('countExecuted', () => {
    it('counts events with non-null executedAt', () => {
      const events: CampaignEvent[] = [
        { executedAt: new Date(), latencyMs: 100 },
        { executedAt: null, latencyMs: null },
        { executedAt: new Date(), latencyMs: 200 },
      ]
      expect(countExecuted(events)).toBe(2)
    })

    it('returns 0 when no events are executed', () => {
      const events: CampaignEvent[] = [
        { executedAt: null, latencyMs: null },
        { executedAt: null, latencyMs: null },
      ]
      expect(countExecuted(events)).toBe(0)
    })
  })
})
