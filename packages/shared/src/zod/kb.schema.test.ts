/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateKBArticleSchema,
  UpdateKBArticleSchema,
  KBSearchQuerySchema,
  ClassifyIntentSchema,
} from './kb.schema.js'

describe('KB schema validation', () => {
  describe('CreateKBArticleSchema', () => {
    const validPayload = {
      title: 'Refund Policy',
      body: '# Refund Policy\n\nWe offer refunds within 30 days.',
      category: 'POLICY' as const,
      tags: ['billing', 'refunds'],
      status: 'PUBLISHED' as const,
    }

    it('accepts valid article', () => {
      const result = CreateKBArticleSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('applies defaults for category, tags, status', () => {
      const result = CreateKBArticleSchema.safeParse({
        title: 'Test',
        body: 'Content',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.category).toBe('FAQ')
        expect(result.data.tags).toEqual([])
        expect(result.data.status).toBe('DRAFT')
      }
    })

    it('rejects empty title', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, title: '' })
      expect(result.success).toBe(false)
    })

    it('rejects empty body', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, body: '' })
      expect(result.success).toBe(false)
    })

    it('rejects title exceeding 500 chars', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, title: 'a'.repeat(501) })
      expect(result.success).toBe(false)
    })

    it('rejects body exceeding 100000 chars', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, body: 'a'.repeat(100_001) })
      expect(result.success).toBe(false)
    })

    it('rejects invalid category', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, category: 'INVALID' })
      expect(result.success).toBe(false)
    })

    it('accepts all valid categories', () => {
      for (const category of ['FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER'] as const) {
        const result = CreateKBArticleSchema.safeParse({ ...validPayload, category })
        expect(result.success).toBe(true)
      }
    })

    it('rejects more than 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`)
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, tags })
      expect(result.success).toBe(false)
    })

    it('rejects empty tag strings', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, tags: [''] })
      expect(result.success).toBe(false)
    })

    it('rejects tag exceeding 50 chars', () => {
      const result = CreateKBArticleSchema.safeParse({ ...validPayload, tags: ['a'.repeat(51)] })
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateKBArticleSchema', () => {
    it('accepts partial update with title only', () => {
      const result = UpdateKBArticleSchema.safeParse({ title: 'New Title' })
      expect(result.success).toBe(true)
    })

    it('accepts empty object (no fields to update)', () => {
      const result = UpdateKBArticleSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects empty title string', () => {
      const result = UpdateKBArticleSchema.safeParse({ title: '' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid status', () => {
      const result = UpdateKBArticleSchema.safeParse({ status: 'ARCHIVED' })
      expect(result.success).toBe(false)
    })
  })

  describe('KBSearchQuerySchema', () => {
    it('accepts valid query', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'how do I get a refund', limit: 5 })
      expect(result.success).toBe(true)
    })

    it('defaults limit to 5', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'refund' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(5)
      }
    })

    it('coerces string limit to number', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'test', limit: '10' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10)
      }
    })

    it('rejects empty query', () => {
      const result = KBSearchQuerySchema.safeParse({ q: '' })
      expect(result.success).toBe(false)
    })

    it('rejects query exceeding 2000 chars', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'a'.repeat(2001) })
      expect(result.success).toBe(false)
    })

    it('rejects limit below 1', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'test', limit: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects limit above 20', () => {
      const result = KBSearchQuerySchema.safeParse({ q: 'test', limit: 21 })
      expect(result.success).toBe(false)
    })
  })

  describe('ClassifyIntentSchema', () => {
    it('accepts valid intent text', () => {
      const result = ClassifyIntentSchema.safeParse({ text: 'I was charged twice for my order' })
      expect(result.success).toBe(true)
    })

    it('rejects empty text', () => {
      const result = ClassifyIntentSchema.safeParse({ text: '' })
      expect(result.success).toBe(false)
    })

    it('rejects text exceeding 10000 chars', () => {
      const result = ClassifyIntentSchema.safeParse({ text: 'a'.repeat(10_001) })
      expect(result.success).toBe(false)
    })
  })
})
