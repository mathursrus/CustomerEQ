/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { floatToSentimentBucket } from './sentimentBucket.js'

// The AI sentiment analyzer returns -1..+1 floats; MemberNote.sentiment
// stores a 5-bucket string enum ('very_negative' .. 'very_positive') so
// the health-score formula can weight reps' observations consistently.
// These tests pin the bucket boundaries. If a boundary changes the health
// score weights must be reviewed in lockstep.

describe('floatToSentimentBucket', () => {
  describe('normal values', () => {
    it('maps -1.0 to very_negative', () => {
      expect(floatToSentimentBucket(-1.0)).toBe('very_negative')
    })

    it('maps -0.7 to very_negative', () => {
      expect(floatToSentimentBucket(-0.7)).toBe('very_negative')
    })

    it('maps -0.6 exactly to very_negative (boundary)', () => {
      expect(floatToSentimentBucket(-0.6)).toBe('very_negative')
    })

    it('maps -0.5 to negative', () => {
      expect(floatToSentimentBucket(-0.5)).toBe('negative')
    })

    it('maps -0.2 exactly to negative (boundary)', () => {
      expect(floatToSentimentBucket(-0.2)).toBe('negative')
    })

    it('maps -0.1 to neutral', () => {
      expect(floatToSentimentBucket(-0.1)).toBe('neutral')
    })

    it('maps 0 to neutral', () => {
      expect(floatToSentimentBucket(0)).toBe('neutral')
    })

    it('maps 0.1 to neutral', () => {
      expect(floatToSentimentBucket(0.1)).toBe('neutral')
    })

    it('maps 0.2 exactly to positive (boundary)', () => {
      expect(floatToSentimentBucket(0.2)).toBe('positive')
    })

    it('maps 0.5 to positive', () => {
      expect(floatToSentimentBucket(0.5)).toBe('positive')
    })

    it('maps 0.6 exactly to very_positive (boundary)', () => {
      expect(floatToSentimentBucket(0.6)).toBe('very_positive')
    })

    it('maps 0.8 to very_positive', () => {
      expect(floatToSentimentBucket(0.8)).toBe('very_positive')
    })

    it('maps 1.0 to very_positive', () => {
      expect(floatToSentimentBucket(1.0)).toBe('very_positive')
    })
  })

  describe('out-of-range values are clamped', () => {
    it('clamps values above 1.0 to very_positive', () => {
      expect(floatToSentimentBucket(1.5)).toBe('very_positive')
      expect(floatToSentimentBucket(999)).toBe('very_positive')
    })

    it('clamps values below -1.0 to very_negative', () => {
      expect(floatToSentimentBucket(-1.5)).toBe('very_negative')
      expect(floatToSentimentBucket(-999)).toBe('very_negative')
    })
  })

  describe('invalid inputs return null', () => {
    it('returns null for NaN', () => {
      expect(floatToSentimentBucket(NaN)).toBeNull()
    })

    it('returns null for Infinity', () => {
      expect(floatToSentimentBucket(Infinity)).toBeNull()
      expect(floatToSentimentBucket(-Infinity)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(floatToSentimentBucket(undefined as unknown as number)).toBeNull()
    })

    it('returns null for null', () => {
      expect(floatToSentimentBucket(null as unknown as number)).toBeNull()
    })
  })
})
