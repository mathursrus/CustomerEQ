/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { EnrollMemberSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Member enrollment schema validation (Issue #231 PR2 — polymorphic identifier)
// ---------------------------------------------------------------------------

describe('EnrollMemberSchema', () => {
  const valid = {
    programId: 'prog-123',
    memberId: 'member@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  }

  it('accepts a minimal payload with just programId + memberId', () => {
    expect(EnrollMemberSchema.safeParse({ programId: 'prog-123', memberId: 'm@x.com' }).success).toBe(
      true,
    )
  })

  it('accepts a full payload with all optional fields', () => {
    const full = {
      ...valid,
      email: 'pii@example.com',
      phone: '+1234567890',
      consentGivenAt: new Date().toISOString(),
      consentVersion: 'privacy-v2.0',
      emailOptIn: true,
      smsOptIn: false,
      clerkToken: 'eyJ...',
    }
    expect(EnrollMemberSchema.safeParse(full).success).toBe(true)
  })

  it('treats consentGivenAt as optional (R8 server-stamps when absent)', () => {
    expect(EnrollMemberSchema.safeParse(valid).success).toBe(true)
  })

  it('preserves a caller-supplied consentGivenAt when present', () => {
    const ts = '2024-01-01T00:00:00.000Z'
    const parsed = EnrollMemberSchema.parse({ ...valid, consentGivenAt: ts })
    expect(parsed.consentGivenAt).toBe(ts)
  })

  it('rejects malformed consentGivenAt', () => {
    expect(
      EnrollMemberSchema.safeParse({ ...valid, consentGivenAt: 'not-a-datetime' }).success,
    ).toBe(false)
  })

  it('rejects missing memberId', () => {
    const { memberId: _, ...noId } = valid
    expect(EnrollMemberSchema.safeParse(noId).success).toBe(false)
  })

  it('rejects missing programId', () => {
    const { programId: _, ...noProgramId } = valid
    expect(EnrollMemberSchema.safeParse(noProgramId).success).toBe(false)
  })

  it('treats email as an optional PII sidecar', () => {
    // No email — accepted; identifier-shape validation runs at the service layer
    // against Brand.memberIdentifierKind, not in the zod schema.
    expect(EnrollMemberSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects malformed email when present', () => {
    expect(EnrollMemberSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('defaults emailOptIn / smsOptIn to false', () => {
    const parsed = EnrollMemberSchema.parse(valid)
    expect(parsed.emailOptIn).toBe(false)
    expect(parsed.smsOptIn).toBe(false)
  })

  it('defaults consentVersion to privacy-v1.0 when absent', () => {
    const parsed = EnrollMemberSchema.parse(valid)
    expect(parsed.consentVersion).toBe('privacy-v1.0')
  })
})
