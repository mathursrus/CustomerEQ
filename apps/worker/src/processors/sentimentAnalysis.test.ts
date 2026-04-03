/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { heuristicAnalyze } from './sentimentAnalysis.js'

describe('heuristicAnalyze — sentiment analysis', () => {
  describe('sentiment scoring', () => {
    it('returns positive sentiment for positive text', () => {
      const result = heuristicAnalyze('The service was great and the team was amazing and helpful')
      expect(result.sentiment).toBeGreaterThan(0)
    })

    it('returns negative sentiment for negative text', () => {
      const result = heuristicAnalyze('Terrible experience, the product was broken and support was awful')
      expect(result.sentiment).toBeLessThan(0)
    })

    it('returns neutral sentiment for neutral text', () => {
      const result = heuristicAnalyze('I ordered a blue shirt and received it on Tuesday')
      expect(result.sentiment).toBe(0)
    })

    it('clamps sentiment to [-1, 1] range', () => {
      // Many positive words — should still clamp to 1.0
      const result = heuristicAnalyze(
        'great excellent amazing love fantastic wonderful happy fast easy helpful recommend best perfect awesome satisfied',
      )
      expect(result.sentiment).toBeLessThanOrEqual(1)
      expect(result.sentiment).toBeGreaterThanOrEqual(-1)
    })

    it('clamps negative sentiment to -1', () => {
      const result = heuristicAnalyze(
        'terrible awful horrible hate worst slow broken frustrating disappointed poor bad difficult confusing annoying never',
      )
      expect(result.sentiment).toBe(-1)
    })
  })

  describe('topic extraction', () => {
    it('extracts shipping topic', () => {
      const result = heuristicAnalyze('The shipping was slow and the delivery took forever')
      expect(result.topics).toContain('shipping')
    })

    it('extracts support topic', () => {
      const result = heuristicAnalyze('Customer support agent was very helpful')
      expect(result.topics).toContain('support')
    })

    it('extracts pricing topic', () => {
      const result = heuristicAnalyze('The product is too expensive for what you get')
      expect(result.topics).toContain('pricing')
    })

    it('extracts product topic', () => {
      const result = heuristicAnalyze('Product quality was excellent, great features')
      expect(result.topics).toContain('product')
    })

    it('extracts experience topic', () => {
      const result = heuristicAnalyze('The website checkout process was confusing')
      expect(result.topics).toContain('experience')
    })

    it('extracts multiple topics', () => {
      const result = heuristicAnalyze('The product was great but shipping was slow and expensive')
      expect(result.topics).toContain('product')
      expect(result.topics).toContain('shipping')
      expect(result.topics).toContain('pricing')
    })

    it('returns empty topics for generic text', () => {
      const result = heuristicAnalyze('Everything was fine, nothing special to mention')
      expect(result.topics).toEqual([])
    })
  })
})
