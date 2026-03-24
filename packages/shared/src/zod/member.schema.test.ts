/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { EnrollMemberSchema } from './member.schema'

describe('EnrollMemberSchema', () => {
  const requiredBase = {
    email: 'jane.doe@example.com',
    consentGivenAt: '2026-03-24T10:00:00.000Z',
    programId: 'prog-abc-123',
  }

  describe('valid inputs', () => {
    it('accepts a valid enrollment with all required fields and optional firstName/lastName', () => {
      const input = {
        ...requiredBase,
        firstName: 'Jane',
        lastName: 'Doe',
      }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a valid enrollment with only required fields and no optional ones', () => {
      const result = EnrollMemberSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
    })

    it('accepts a valid enrollment with only firstName provided', () => {
      const input = { ...requiredBase, firstName: 'FirstOnly' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a valid enrollment with only lastName provided', () => {
      const input = { ...requiredBase, lastName: 'LastOnly' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts email addresses with subdomains', () => {
      const input = { ...requiredBase, email: 'user@mail.subdomain.example.co.uk' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts email addresses with plus signs', () => {
      const input = { ...requiredBase, email: 'user+tag@example.com' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a valid phone when provided', () => {
      const input = { ...requiredBase, phone: '+1-555-000-1234' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects when email is missing entirely', () => {
      const { email: _removed, ...input } = requiredBase as typeof requiredBase & { email?: string }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('email'))).toBe(true)
    })

    it('rejects an invalid email format missing the @ symbol', () => {
      const input = { ...requiredBase, email: 'not-an-email' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('email'))).toBe(true)
    })

    it('rejects an invalid email format missing the domain', () => {
      const input = { ...requiredBase, email: 'user@' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('email'))).toBe(true)
    })

    it('rejects an empty string for email', () => {
      const input = { ...requiredBase, email: '' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('email'))).toBe(true)
    })

    it('rejects a numeric value for email', () => {
      const input = { ...requiredBase, email: 12345 }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('email'))).toBe(true)
    })

    it('rejects when consentGivenAt is missing', () => {
      const { consentGivenAt: _removed, ...input } = requiredBase as typeof requiredBase & {
        consentGivenAt?: string
      }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('consentGivenAt'))).toBe(true)
    })

    it('rejects a non-ISO-8601 string for consentGivenAt', () => {
      const input = { ...requiredBase, consentGivenAt: 'not-a-date' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('consentGivenAt'))).toBe(true)
    })

    it('rejects when programId is missing', () => {
      const { programId: _removed, ...input } = requiredBase as typeof requiredBase & {
        programId?: string
      }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('programId'))).toBe(true)
    })

    it('rejects an empty string for programId', () => {
      const input = { ...requiredBase, programId: '' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('programId'))).toBe(true)
    })

    it('rejects a numeric value for firstName', () => {
      const input = { ...requiredBase, firstName: 123 }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('firstName'))).toBe(true)
    })

    it('rejects a numeric value for lastName', () => {
      const input = { ...requiredBase, lastName: 456 }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('lastName'))).toBe(true)
    })
  })
})
