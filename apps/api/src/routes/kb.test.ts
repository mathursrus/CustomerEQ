/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateKBArticleSchema,
  UpdateKBArticleSchema,
  KBSearchQuerySchema,
} from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// KB article schema validation — unit tests
// Integration tests (with real DB + pgvector) live in apps/api/test/integration/
// ---------------------------------------------------------------------------

describe('KB article schema validation', () => {
  describe('CreateKBArticleSchema', () => {
    const valid = {
      title: 'Refund Policy',
      body: '# Refund Policy\n\nWe offer full refunds within 30 days of purchase.',
      category: 'POLICY' as const,
      tags: ['billing', 'refunds'],
      status: 'PUBLISHED' as const,
    }

    it('accepts a valid KB article payload', () => {
      expect(CreateKBArticleSchema.safeParse(valid).success).toBe(true)
    })

    it('applies defaults — category FAQ, tags empty, status DRAFT', () => {
      const result = CreateKBArticleSchema.safeParse({ title: 'FAQ Item', body: 'Content here' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.category).toBe('FAQ')
        expect(result.data.tags).toEqual([])
        expect(result.data.status).toBe('DRAFT')
      }
    })

    it('rejects empty title', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, title: '' }).success).toBe(false)
    })

    it('rejects empty body', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, body: '' }).success).toBe(false)
    })

    it('rejects invalid category', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, category: 'UNKNOWN' }).success).toBe(false)
    })

    it('accepts all 6 valid categories', () => {
      const categories = ['FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER'] as const
      for (const category of categories) {
        expect(CreateKBArticleSchema.safeParse({ ...valid, category }).success).toBe(true)
      }
    })

    it('rejects more than 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`)
      expect(CreateKBArticleSchema.safeParse({ ...valid, tags }).success).toBe(false)
    })

    it('rejects tag longer than 50 characters', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, tags: ['a'.repeat(51)] }).success).toBe(false)
    })

    it('rejects title longer than 500 characters', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, title: 'a'.repeat(501) }).success).toBe(false)
    })

    it('rejects body longer than 100000 characters', () => {
      expect(CreateKBArticleSchema.safeParse({ ...valid, body: 'x'.repeat(100_001) }).success).toBe(false)
    })
  })

  describe('UpdateKBArticleSchema', () => {
    it('accepts partial update — title only', () => {
      expect(UpdateKBArticleSchema.safeParse({ title: 'New Title' }).success).toBe(true)
    })

    it('accepts empty object (no-op update)', () => {
      expect(UpdateKBArticleSchema.safeParse({}).success).toBe(true)
    })

    it('rejects empty title string', () => {
      expect(UpdateKBArticleSchema.safeParse({ title: '' }).success).toBe(false)
    })

    it('accepts status change to PUBLISHED', () => {
      expect(UpdateKBArticleSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(true)
    })

    it('rejects invalid status', () => {
      expect(UpdateKBArticleSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false)
    })
  })

  describe('KBSearchQuerySchema', () => {
    it('accepts valid search query with default limit', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'how do I get a refund' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(5)
      }
    })

    it('accepts explicit limit', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'refund', limit: 10 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10)
      }
    })

    it('coerces string limit to number', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'test', limit: '3' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(3)
      }
    })

    it('rejects empty query', () => {
      expect(KBSearchQuerySchema.safeParse({ q: '' }).success).toBe(false)
    })

    it('rejects query over 2000 characters', () => {
      expect(KBSearchQuerySchema.safeParse({ q: 'a'.repeat(2001) }).success).toBe(false)
    })

    it('rejects limit below 1', () => {
      expect(KBSearchQuerySchema.safeParse({ q: 'test', limit: 0 }).success).toBe(false)
    })

    it('rejects limit above 20', () => {
      expect(KBSearchQuerySchema.safeParse({ q: 'test', limit: 21 }).success).toBe(false)
    })
  })
})
