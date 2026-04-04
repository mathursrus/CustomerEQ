/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { ClassifyIntentSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Intent classification schema validation — unit tests
// Integration tests (with real DB + BAML) live in apps/api/test/integration/
// ---------------------------------------------------------------------------

describe('Intent classification schema validation', () => {
  describe('ClassifyIntentSchema', () => {
    it('accepts valid intent text', () => {
      const result = ClassifyIntentSchema.safeParse({ text: 'I was charged twice for my last order' })
      expect(result.success).toBe(true)
    })

    it('rejects empty text', () => {
      expect(ClassifyIntentSchema.safeParse({ text: '' }).success).toBe(false)
    })

    it('rejects missing text field', () => {
      expect(ClassifyIntentSchema.safeParse({}).success).toBe(false)
    })

    it('rejects text over 10000 characters', () => {
      expect(ClassifyIntentSchema.safeParse({ text: 'x'.repeat(10_001) }).success).toBe(false)
    })

    it('accepts text at max boundary (10000 chars)', () => {
      expect(ClassifyIntentSchema.safeParse({ text: 'x'.repeat(10_000) }).success).toBe(true)
    })

    it('preserves the text value after parse', () => {
      const result = ClassifyIntentSchema.safeParse({ text: 'Hello support team' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.text).toBe('Hello support team')
      }
    })
  })
})
