/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  authenticatedRequest,
  unauthenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('Demo Requests API', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // -------------------------------------------------------------------------
  // POST /v1/public/demo-requests
  // -------------------------------------------------------------------------

  describe('POST /v1/public/demo-requests', () => {
    it('creates a DemoRequest record and returns 201 when all required fields are provided', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          workEmail: 'jane.doe@acme.com',
          companyName: 'Acme Corp',
          companySize: '51-200',
          message: 'Interested in the loyalty platform',
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.workEmail).toBe('jane.doe@acme.com')
      expect(res.body.firstName).toBe('Jane')
      expect(res.body.companyName).toBe('Acme Corp')
      expect(res.body.createdAt).toBeDefined()
      expect(new Date(res.body.createdAt).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('creates a DemoRequest without optional fields (message)', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'Sam',
          lastName: 'Lee',
          workEmail: 'sam@startup.io',
          companyName: 'Startup Inc',
          companySize: '1-10',
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.workEmail).toBe('sam@startup.io')
    })

    it('returns 422 when workEmail is missing', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'NoEmail',
          lastName: 'User',
          companyName: 'Some Company',
          companySize: '11-50',
        })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 422 when workEmail is not a valid email format', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'Bad',
          lastName: 'Email',
          workEmail: 'not-an-email',
          companyName: 'Some Co',
          companySize: '1-10',
        })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 422 when firstName is missing', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          lastName: 'Smith',
          workEmail: 'john@corp.com',
          companyName: 'Corp Ltd',
          companySize: '51-200',
        })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 422 when companyName is missing', async () => {
      const request = unauthenticatedRequest()

      const res = await request
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'Anon',
          lastName: 'User',
          workEmail: 'anon@example.com',
          companySize: '11-50',
        })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/admin/demo-requests
  // -------------------------------------------------------------------------

  describe('GET /v1/admin/demo-requests', () => {
    it('returns 200 with a list that includes a previously submitted demo request', async () => {
      const publicReq = unauthenticatedRequest()

      // First submit a demo request via the public endpoint
      const submitRes = await publicReq
        .post('/v1/public/demo-requests')
        .send({
          firstName: 'Admin',
          lastName: 'Test',
          workEmail: 'admin.test@bigcorp.com',
          companyName: 'BigCorp',
          companySize: '1000+',
        })
      expect(submitRes.status).toBe(201)
      const submittedId = submitRes.body.id

      // Now fetch as an authenticated admin
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/admin/demo-requests')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)

      const found = res.body.find((r: { id: string }) => r.id === submittedId)
      expect(found).toBeDefined()
      expect(found.workEmail).toBe('admin.test@bigcorp.com')
    })

    it('returns a list sorted by createdAt descending (newest first)', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/admin/demo-requests')

      expect(res.status).toBe(200)
      const items: Array<{ createdAt: string }> = res.body

      if (items.length >= 2) {
        for (let i = 1; i < items.length; i++) {
          const prev = new Date(items[i - 1].createdAt).getTime()
          const curr = new Date(items[i].createdAt).getTime()
          expect(prev).toBeGreaterThanOrEqual(curr)
        }
      }
    })

    it('returns 401 when the request is unauthenticated', async () => {
      const request = unauthenticatedRequest()

      const res = await request.get('/v1/admin/demo-requests')

      expect(res.status).toBe(401)
    })
  })
})
