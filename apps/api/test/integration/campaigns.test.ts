/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createCampaign,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Campaigns API — /v1/campaigns', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // -------------------------------------------------------------------------
  // POST /v1/campaigns
  // -------------------------------------------------------------------------

  describe('POST /v1/campaigns', () => {
    it('creates a campaign with status=DRAFT', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/campaigns').send({
        programId: program.id,
        name: 'NPS Recovery Campaign',
        triggerType: 'cx.nps_submitted',
        triggerCondition: { field: 'nps_score', op: 'lt', value: 7 },
        actionType: 'award_points',
        actionConfig: { points: 200 },
        startDate: new Date().toISOString(),
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('NPS Recovery Campaign')
      expect(res.body.status).toBe('DRAFT')
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 422 when required fields are missing', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/campaigns').send({
        triggerType: 'cx.nps_submitted',
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/campaigns/:id
  // -------------------------------------------------------------------------

  describe('GET /v1/campaigns/:id', () => {
    it("returns 200 with campaign data for own brand's campaign", async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        triggerEventType: 'cx.nps_submitted',
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get(`/v1/campaigns/${campaign.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(campaign.id)
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 404 when fetching a campaign from a different brand', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id, status: 'ACTIVE' })
      const campaign = await createCampaign({
        brandId: ownerBrand.id,
        programId: program.id,
        triggerEventType: 'cx.nps_submitted',
      })

      const otherBrand = await createBrand()
      const request = authenticatedRequest(otherBrand.id)

      const res = await request.get(`/v1/campaigns/${campaign.id}`)

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /v1/campaigns/:id/status
  // -------------------------------------------------------------------------

  describe('PATCH /v1/campaigns/:id/status', () => {
    it('activates a DRAFT campaign and returns status=ACTIVE', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'DRAFT',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch(`/v1/campaigns/${campaign.id}/status`)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ACTIVE')
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/campaigns
  // -------------------------------------------------------------------------

  describe('GET /v1/campaigns', () => {
    it('returns a list of campaigns for the brand', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createCampaign({
        brandId: brand.id,
        programId: program.id,
        triggerEventType: 'cx.nps_submitted',
      })
      await createCampaign({
        brandId: brand.id,
        programId: program.id,
        triggerEventType: 'cx.csat_submitted',
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.campaigns)).toBe(true)
      expect(res.body.campaigns.length).toBe(2)
      expect(res.body.campaigns[0].brandId).toBe(brand.id)
      expect(res.body.campaigns[1].brandId).toBe(brand.id)
    })

    it('returns an empty array for a brand with no campaigns', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.campaigns)).toBe(true)
      expect(res.body.campaigns).toHaveLength(0)
    })

    it('does not include campaigns from other brands (tenant isolation)', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      const programA = await createProgram({ brandId: brandA.id, status: 'ACTIVE' })
      const programB = await createProgram({ brandId: brandB.id, status: 'ACTIVE' })
      await createCampaign({
        brandId: brandA.id,
        programId: programA.id,
        triggerEventType: 'cx.nps_submitted',
      })
      await createCampaign({
        brandId: brandB.id,
        programId: programB.id,
        triggerEventType: 'cx.nps_submitted',
      })
      const request = authenticatedRequest(brandA.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.campaigns)).toBe(true)
      expect(res.body.campaigns.length).toBe(1)
      expect(res.body.campaigns[0].brandId).toBe(brandA.id)
      expect(res.body.campaigns.every((c: { brandId: string }) => c.brandId === brandA.id)).toBe(true)
    })
  })
})
