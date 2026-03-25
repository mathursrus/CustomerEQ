/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createMember,
  authenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('Members API — /v1/members', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // -------------------------------------------------------------------------
  // POST /v1/members/enroll
  // -------------------------------------------------------------------------

  describe('POST /v1/members/enroll', () => {
    it('enrolls a new member and returns status=ACTIVE', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/members/enroll').send({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        programId: program.id,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.email).toBe('alice@example.com')
      expect(res.body.status).toBe('ACTIVE')
      expect(res.body.brandId).toBe(brand.id)
      expect(res.body.pointsBalance).toBe(0)
    })

    it('returns the existing member (idempotency) when enrolling the same email twice', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const payload = {
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        programId: program.id,
        consentGivenAt: new Date().toISOString(),
      }

      const firstRes = await request.post('/v1/members/enroll').send(payload)
      expect(firstRes.status).toBe(201)
      const firstId = firstRes.body.id

      const secondRes = await request.post('/v1/members/enroll').send(payload)
      expect(secondRes.status).toBe(200)
      expect(secondRes.body.id).toBe(firstId)
    })

    it('returns 422 "consent required" when consentGivenAt is absent', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/members/enroll').send({
        email: 'noconsent@example.com',
        firstName: 'No',
        lastName: 'Consent',
        programId: program.id,
      })

      expect(res.status).toBe(422)
      expect(res.body.message).toMatch(/consent/i)
    })

    it('returns 422 when email is missing', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/members/enroll').send({
        firstName: 'Missing',
        lastName: 'Email',
        programId: program.id,
        consentGivenAt: new Date().toISOString(),
      })

      expect(res.status).toBe(422)
      expect(res.body.message).toMatch(/email/i)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/:id
  // -------------------------------------------------------------------------

  describe('GET /v1/members/:id', () => {
    it("returns 200 with member data when fetching own brand's member", async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/members/${member.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(member.id)
      expect(res.body.email).toBe(member.email)
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 404 when fetching a member that belongs to a different brand (tenant isolation)', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id, status: 'ACTIVE' })
      const member = await createMember({ brandId: ownerBrand.id, programId: program.id })

      const otherBrand = await createBrand()
      const request = await authenticatedRequest(otherBrand.id)

      const res = await request.get(`/v1/members/${member.id}`)

      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-existent member id', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

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
      const member = await createMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/members/${member.id}/balance`)

      expect(res.status).toBe(200)
      expect(res.body.pointsBalance).toBe(0)
      expect(Array.isArray(res.body.recentEvents)).toBe(true)
      expect(res.body.recentEvents).toHaveLength(0)
    })

    it('returns 404 when fetching balance for a member from a different brand', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id, status: 'ACTIVE' })
      const member = await createMember({ brandId: ownerBrand.id, programId: program.id })

      const otherBrand = await createBrand()
      const request = await authenticatedRequest(otherBrand.id)

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
      await createMember({
        brandId: brand.id,
        programId: program.id,
        clerkUserId: 'user_test_123',
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me/balance')

      expect(res.status).toBe(200)
      expect(res.body.pointsBalance).toBe(0)
      expect(Array.isArray(res.body.recentEvents)).toBe(true)
    })

    it('returns 404 when no member exists for the authenticated user', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/me/balance')

      expect(res.status).toBe(404)
    })
  })
})
