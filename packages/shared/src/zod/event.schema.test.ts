/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { IngestEventSchema } from './event.schema'

describe('IngestEventSchema', () => {
  describe('valid inputs', () => {
    it('accepts a fully populated event with all optional fields provided', () => {
      const input = {
        eventType: 'purchase',
        memberId: 'member-abc-123',
        payload: { orderId: 'ord-999', amount: 49.99, currency: 'USD' },
        idempotencyKey: 'idem-key-xyz-001',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a minimal event with only required fields', () => {
      const input = {
        eventType: 'login',
        memberId: 'member-def-456',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts an event with an empty payload object', () => {
      const input = {
        eventType: 'page_view',
        memberId: 'member-ghi-789',
        payload: {},
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts an event with a nested payload object', () => {
      const input = {
        eventType: 'checkout_completed',
        memberId: 'member-jkl-000',
        payload: {
          cart: { items: ['item-1', 'item-2'], subtotal: 120.0 },
          promoCode: 'SAVE10',
        },
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts an event with an idempotency key and no payload', () => {
      const input = {
        eventType: 'review_submitted',
        memberId: 'member-mno-111',
        idempotencyKey: 'review-idem-abc',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects when eventType is missing', () => {
      const input = {
        memberId: 'member-abc-123',
        payload: { amount: 10 },
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('eventType'))).toBe(true)
    })

    it('rejects when eventType is an empty string', () => {
      const input = {
        eventType: '',
        memberId: 'member-abc-123',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('eventType'))).toBe(true)
    })

    it('rejects when memberId is missing', () => {
      const input = {
        eventType: 'purchase',
        payload: { amount: 50 },
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('memberId'))).toBe(true)
    })

    it('rejects when memberId is an empty string', () => {
      const input = {
        eventType: 'purchase',
        memberId: '',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('memberId'))).toBe(true)
    })

    it('rejects a non-string eventType', () => {
      const input = {
        eventType: 42,
        memberId: 'member-abc-123',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('eventType'))).toBe(true)
    })

    it('rejects a non-string memberId', () => {
      const input = {
        eventType: 'purchase',
        memberId: true,
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('memberId'))).toBe(true)
    })

    it('rejects a non-object payload (string instead of object)', () => {
      const input = {
        eventType: 'purchase',
        memberId: 'member-abc-123',
        payload: 'not-an-object',
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('payload'))).toBe(true)
    })

    it('rejects a non-string idempotencyKey', () => {
      const input = {
        eventType: 'purchase',
        memberId: 'member-abc-123',
        idempotencyKey: 99999,
      }

      const result = IngestEventSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('idempotencyKey'))).toBe(true)
    })
  })
})
