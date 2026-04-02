import { describe, it, expect } from 'vitest'
import { selectWeightedRandom } from './random'

describe('selectWeightedRandom', () => {
  describe('basic selection', () => {
    it('returns the only item when array has one element', () => {
      const items = [{ probability: 100, label: 'only' }]
      const result = selectWeightedRandom(items)
      expect(result.label).toBe('only')
    })

    it('returns an item from the array', () => {
      const items = [
        { probability: 50, label: 'a' },
        { probability: 50, label: 'b' },
      ]
      const result = selectWeightedRandom(items)
      expect(['a', 'b']).toContain(result.label)
    })

    it('never selects a 0-probability item over 1000 iterations', () => {
      const items = [
        { probability: 0, label: 'never' },
        { probability: 100, label: 'always' },
      ]
      for (let i = 0; i < 1000; i++) {
        const result = selectWeightedRandom(items)
        expect(result.label).toBe('always')
      }
    })
  })

  describe('fairness over large sample', () => {
    it('distributes selections proportionally over 10000 iterations', () => {
      const items = [
        { probability: 40, label: 'a' },
        { probability: 35, label: 'b' },
        { probability: 25, label: 'c' },
      ]

      const counts: Record<string, number> = { a: 0, b: 0, c: 0 }
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        const result = selectWeightedRandom(items)
        counts[result.label]++
      }

      // Chi-squared test: expect each bucket within 5% of expected
      const expectedA = iterations * 0.4
      const expectedB = iterations * 0.35
      const expectedC = iterations * 0.25

      expect(Math.abs(counts.a - expectedA) / expectedA).toBeLessThan(0.05)
      expect(Math.abs(counts.b - expectedB) / expectedB).toBeLessThan(0.05)
      expect(Math.abs(counts.c - expectedC) / expectedC).toBeLessThan(0.05)
    })

    it('handles equal probabilities fairly', () => {
      const items = [
        { probability: 25, label: 'a' },
        { probability: 25, label: 'b' },
        { probability: 25, label: 'c' },
        { probability: 25, label: 'd' },
      ]

      const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 }
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        const result = selectWeightedRandom(items)
        counts[result.label]++
      }

      // Each should be ~2500 (within 6% tolerance)
      for (const label of ['a', 'b', 'c', 'd']) {
        expect(Math.abs(counts[label] - 2500) / 2500).toBeLessThan(0.06)
      }
    })
  })

  describe('edge cases', () => {
    it('throws on empty array', () => {
      expect(() => selectWeightedRandom([])).toThrow(
        'Cannot select from empty items array',
      )
    })

    it('handles very small probabilities', () => {
      const items = [
        { probability: 99.5, label: 'big' },
        { probability: 0.5, label: 'small' },
      ]
      // Just verify it doesn't crash and returns a valid item
      for (let i = 0; i < 100; i++) {
        const result = selectWeightedRandom(items)
        expect(['big', 'small']).toContain(result.label)
      }
    })

    it('handles 8 segments (max wheel size)', () => {
      const items = Array.from({ length: 8 }, (_, i) => ({
        probability: 12.5,
        label: `seg${i}`,
      }))

      const result = selectWeightedRandom(items)
      expect(result.label).toMatch(/^seg\d$/)
    })

    it('handles 2 segments (min wheel size)', () => {
      const items = [
        { probability: 70, label: 'a' },
        { probability: 30, label: 'b' },
      ]

      const result = selectWeightedRandom(items)
      expect(['a', 'b']).toContain(result.label)
    })
  })
})
