/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  EnrollMemberSchema,
  HealthScoreWeightsSchema,
  HealthScoreFilterSchema,
  RecomputeHealthScoreSchema,
} from './member.schema'

describe('EnrollMemberSchema', () => {
  const requiredBase = {
    email: 'jane.doe@example.com',
    consentGivenAt: '2026-03-24T10:00:00.000Z',
    programId: 'prog-abc-123',
    consentGiven: true as const,
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

  describe('consentGiven field', () => {
    it('rejects when consentGiven is false — emits CONSENT_REQUIRED message', () => {
      const input = { ...requiredBase, consentGiven: false }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(
        result.error?.issues.some(
          (i) => i.path.includes('consentGiven') && i.message === 'CONSENT_REQUIRED',
        ),
      ).toBe(true)
    })

    it('rejects when consentGiven is missing entirely', () => {
      const { consentGiven: _removed, ...input } = requiredBase as typeof requiredBase & {
        consentGiven?: true
      }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('consentGiven'))).toBe(true)
    })

    it('rejects when consentGiven is a string "true" instead of boolean true', () => {
      const input = { ...requiredBase, consentGiven: 'true' }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('consentGiven'))).toBe(true)
    })
  })

  describe('opt-in defaults', () => {
    it('emailOptIn defaults to false when omitted', () => {
      const result = EnrollMemberSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.emailOptIn).toBe(false)
      }
    })

    it('smsOptIn defaults to false when omitted', () => {
      const result = EnrollMemberSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.smsOptIn).toBe(false)
      }
    })

    it('consentVersion defaults to "privacy-v1.0" when omitted', () => {
      const result = EnrollMemberSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.consentVersion).toBe('privacy-v1.0')
      }
    })

    it('accepts explicit emailOptIn: true', () => {
      const input = { ...requiredBase, emailOptIn: true }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.emailOptIn).toBe(true)
      }
    })

    it('accepts explicit smsOptIn: true', () => {
      const input = { ...requiredBase, smsOptIn: true }

      const result = EnrollMemberSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.smsOptIn).toBe(true)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Health Score Schemas
// ---------------------------------------------------------------------------

describe('HealthScoreWeightsSchema', () => {
  it('accepts valid default weights that sum to 1.0', () => {
    const input = {
      recency: 0.25,
      frequency: 0.20,
      sentiment: 0.25,
      nps: 0.15,
      engagement: 0.15,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects weights that do not sum to 1.0', () => {
    const input = {
      recency: 0.5,
      frequency: 0.5,
      sentiment: 0.5,
      nps: 0.5,
      engagement: 0.5,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects negative weights', () => {
    const input = {
      recency: -0.1,
      frequency: 0.30,
      sentiment: 0.30,
      nps: 0.25,
      engagement: 0.25,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects weights greater than 1', () => {
    const input = {
      recency: 1.5,
      frequency: 0,
      sentiment: 0,
      nps: 0,
      engagement: -0.5,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('applies default values when fields are omitted', () => {
    const result = HealthScoreWeightsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recency).toBe(0.25)
      expect(result.data.frequency).toBe(0.20)
      expect(result.data.sentiment).toBe(0.25)
      expect(result.data.nps).toBe(0.15)
      expect(result.data.engagement).toBe(0.15)
    }
  })
})

describe('HealthScoreFilterSchema', () => {
  it('accepts valid healthScoreMin and healthScoreMax', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 0, healthScoreMax: 100 })
    expect(result.success).toBe(true)
  })

  it('accepts only healthScoreMin', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 30 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMin).toBe(30)
      expect(result.data.healthScoreMax).toBeUndefined()
    }
  })

  it('accepts only healthScoreMax', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMax: 70 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMax).toBe(70)
    }
  })

  it('accepts empty object (both optional)', () => {
    const result = HealthScoreFilterSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('coerces string values to numbers', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: '20', healthScoreMax: '80' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMin).toBe(20)
      expect(result.data.healthScoreMax).toBe(80)
    }
  })

  it('rejects values below 0', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects values above 100', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMax: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer values', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 30.5 })
    expect(result.success).toBe(false)
  })
})

describe('RecomputeHealthScoreSchema', () => {
  it('accepts empty object (memberId optional)', () => {
    const result = RecomputeHealthScoreSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts memberId when provided', () => {
    const result = RecomputeHealthScoreSchema.safeParse({ memberId: 'member-abc-123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.memberId).toBe('member-abc-123')
    }
  })

  it('rejects non-string memberId', () => {
    const result = RecomputeHealthScoreSchema.safeParse({ memberId: 123 })
    expect(result.success).toBe(false)
  })
})
