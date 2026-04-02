/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  authenticatedRequest,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Members API — /v1/members', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // -------------------------------------------------------------------------
  // POST /v1/members/enroll
  // -------------------------------------------------------------------------

  describe('POST /v1/members/enroll', () => {
    it('enrolls a new member and returns EnrollMemberResponse shape', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        programId: program.id,
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(201)
      expect(res.body.memberId).toBeDefined()
      expect(res.body.email).toBe('alice@example.com')
      expect(res.body.firstName).toBe('Alice')
      expect(res.body.pointsBalance).toBe(0)
      expect(res.body.programName).toBe(program.name)
      expect(res.body.enrollmentBonusPending).toBe(true)
    })

    it('sets consentGivenAt in the DB after enrollment', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const consentAt = new Date().toISOString()

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'consent-check@example.com',
        firstName: 'Consent',
        lastName: 'Check',
        programId: program.id,
        consentGiven: true,
        consentGivenAt: consentAt,
      })

      expect(res.status).toBe(201)

      const prisma = getTestPrisma()
      const member = await prisma.member.findUnique({
        where: { brandId_email: { brandId: brand.id, email: 'consent-check@example.com' } },
        select: { consentGivenAt: true },
      })
      expect(member?.consentGivenAt).not.toBeNull()
    })

    it('returns 409 EMAIL_ALREADY_ENROLLED when enrolling the same email twice', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const payload = {
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        programId: program.id,
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
      }

      const firstRes = await unauthenticatedRequest().post('/v1/members/enroll').send(payload)
      expect(firstRes.status).toBe(201)

      const secondRes = await unauthenticatedRequest().post('/v1/members/enroll').send(payload)
      expect(secondRes.status).toBe(409)
      expect(secondRes.body.error).toBe('EMAIL_ALREADY_ENROLLED')
    })

    it('returns 422 CONSENT_REQUIRED when consentGiven is false', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'noconsent@example.com',
        firstName: 'No',
        lastName: 'Consent',
        programId: program.id,
        consentGiven: false,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('CONSENT_REQUIRED')
    })

    it('persists emailOptIn and smsOptIn when provided', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'optin@example.com',
        firstName: 'Opt',
        lastName: 'In',
        programId: program.id,
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
        emailOptIn: true,
        smsOptIn: true,
      })

      expect(res.status).toBe(201)

      const prisma = getTestPrisma()
      const member = await prisma.member.findUnique({
        where: { brandId_email: { brandId: brand.id, email: 'optin@example.com' } },
        select: { emailOptIn: true, smsOptIn: true },
      })
      expect(member?.emailOptIn).toBe(true)
      expect(member?.smsOptIn).toBe(true)
    })

    it('returns 422 when consentGivenAt is absent', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'missing-consent-at@example.com',
        firstName: 'No',
        lastName: 'Consent',
        programId: program.id,
        consentGiven: true,
        // consentGivenAt intentionally omitted
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 422 when email is missing', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        firstName: 'Missing',
        lastName: 'Email',
        programId: program.id,
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('allows re-enrollment with same email on a different brand (201)', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      const programA = await createProgram({ brandId: brandA.id, status: 'ACTIVE' })
      const programB = await createProgram({ brandId: brandB.id, status: 'ACTIVE' })
      const email = 'shared@example.com'
      const consentAt = new Date().toISOString()

      const resA = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email,
        firstName: 'Shared',
        lastName: 'User',
        programId: programA.id,
        consentGiven: true,
        consentGivenAt: consentAt,
      })
      expect(resA.status).toBe(201)

      const resB = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email,
        firstName: 'Shared',
        lastName: 'User',
        programId: programB.id,
        consentGiven: true,
        consentGivenAt: consentAt,
      })
      expect(resB.status).toBe(201)
      expect(resB.body.memberId).not.toBe(resA.body.memberId)
    })

    it('returns 404 when programId does not exist', async () => {
      const res = await unauthenticatedRequest().post('/v1/members/enroll').send({
        email: 'badprogram@example.com',
        firstName: 'Bad',
        lastName: 'Program',
        programId: '00000000-0000-0000-0000-000000000000',
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Program not found')
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/:id
  // -------------------------------------------------------------------------

  describe('GET /v1/members/:id', () => {
    it("returns 200 with member data when fetching own brand's member", async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = authenticatedRequest(brand.id)

      const res = await request.get(`/v1/members/${member.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(member.id)
      expect(res.body.email).toBe(member.email)
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 404 when fetching a member that belongs to a different brand (tenant isolation)', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: ownerBrand.id, programId: program.id })

      const otherBrand = await createBrand()
      const request = authenticatedRequest(otherBrand.id)

      const res = await request.get(`/v1/members/${member.id}`)

      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-existent member id', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/:id/balance
  // -------------------------------------------------------------------------

  describe('GET /v1/members/:id/balance', () => {
    it('returns pointsBalance=0 and an empty recentEvents array for a newly enrolled member', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = authenticatedRequest(brand.id)

      const res = await request.get(`/v1/members/${member.id}/balance`)

      expect(res.status).toBe(200)
      expect(res.body.pointsBalance).toBe(0)
      expect(Array.isArray(res.body.recentEvents)).toBe(true)
      expect(res.body.recentEvents).toHaveLength(0)
    })

    it('returns 404 when fetching balance for a member from a different brand', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: ownerBrand.id, programId: program.id })

      const otherBrand = await createBrand()
      const request = authenticatedRequest(otherBrand.id)

      const res = await request.get(`/v1/members/${member.id}/balance`)

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/me/balance
  // -------------------------------------------------------------------------

  describe('GET /v1/members/me/balance', () => {
    it('returns balance for an authenticated member', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      // The authenticatedRequest helper sets X-Test-User-Id to 'user_test_123'
      // We need a member with that clerkUserId
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
      })
      // Manually update the clerkUserId since the factory doesn't support it
      const prisma = getTestPrisma()
      await prisma.member.update({
        where: { id: member.id },
        data: { clerkUserId: 'user_test_123' },
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me/balance')

      expect(res.status).toBe(200)
      expect(res.body.pointsBalance).toBe(0)
      expect(Array.isArray(res.body.recentEvents)).toBe(true)
    })

    it('returns 404 when no member exists for the authenticated user', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me/balance')

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/me
  // -------------------------------------------------------------------------

  describe('GET /v1/members/me', () => {
    it('returns full profile for an authenticated member', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })

      const prisma = getTestPrisma()
      await prisma.member.update({
        where: { id: member.id },
        data: { clerkUserId: 'user_test_123' },
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(member.id)
      expect(res.body.email).toBe(member.email)
      expect(res.body.pointsBalance).toBe(0)
      expect(typeof res.body.emailOptIn).toBe('boolean')
      expect(typeof res.body.smsOptIn).toBe('boolean')
    })

    it('returns 404 when no member record exists for the authenticated clerk user', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me')

      expect(res.status).toBe(404)
    })
  })

})
