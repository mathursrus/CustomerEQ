/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { EnrollMemberSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Member enrollment schema validation
// ---------------------------------------------------------------------------

describe('Member schema validation', () => {
  describe('EnrollMemberSchema', () => {
    const valid = {
      email: 'member@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      programId: 'prog-123',
      consentGiven: true as const,
      consentGivenAt: new Date().toISOString(),
    }

    it('accepts a valid enrollment payload', () => {
      expect(EnrollMemberSchema.safeParse(valid).success).toBe(true)
    })

    it('accepts enrollment with optional fields', () => {
      const full = {
        ...valid,
        phone: '+1234567890',
        emailOptIn: true,
        smsOptIn: false,
      }
      expect(EnrollMemberSchema.safeParse(full).success).toBe(true)
    })

    it('rejects invalid email', () => {
      expect(EnrollMemberSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
    })

    it('rejects missing email', () => {
      const { email: _, ...noEmail } = valid
      expect(EnrollMemberSchema.safeParse(noEmail).success).toBe(false)
    })

    it('rejects missing programId', () => {
      const { programId: _, ...noProgramId } = valid
      expect(EnrollMemberSchema.safeParse(noProgramId).success).toBe(false)
    })

    it('rejects missing consent', () => {
      const { consentGiven: _, ...noConsent } = valid
      expect(EnrollMemberSchema.safeParse(noConsent).success).toBe(false)
    })

    it('rejects consentGiven=false', () => {
      expect(EnrollMemberSchema.safeParse({ ...valid, consentGiven: false }).success).toBe(false)
    })

    it('rejects missing consentGivenAt', () => {
      const { consentGivenAt: _, ...noTimestamp } = valid
      expect(EnrollMemberSchema.safeParse(noTimestamp).success).toBe(false)
    })
  })
})
