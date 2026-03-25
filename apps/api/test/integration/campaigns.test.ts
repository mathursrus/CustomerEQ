/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupTestDb,
  teardownTestDb,
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createCampaign,
  createCxEvent,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Campaigns API — /v1/campaigns', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

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
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/campaigns').send({
        programId: program.id,
        name: 'NPS Recovery Campaign',
        triggerEventType: 'cx.nps_submitted',
        triggerConditions: { score: { lte: 6 } },
        action: { type: 'AWARD_POINTS', points: 200 },
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('NPS Recovery Campaign')
      expect(res.body.status).toBe('DRAFT')
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 422 when required fields are missing', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/campaigns').send({
        triggerEventType: 'cx.nps_submitted',
      })

      expect(res.status).toBe(422)
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
      const request = await authenticatedRequest(brand.id)

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
      const request = await authenticatedRequest(otherBrand.id)

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
      const request = await authenticatedRequest(brand.id)

      const res = await request
        .patch(`/v1/campaigns/${campaign.id}/status`)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ACTIVE')
    })
  })

  // -------------------------------------------------------------------------
  // CampaignEvent creation via POST /v1/events
  // -------------------------------------------------------------------------

  describe('CampaignEvent lifecycle', () => {
    it('creates a CampaignEvent with executedAt set when a CX event matches an active campaign', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = await authenticatedRequest(brand.id)

      await request.post('/v1/events').send({
        type: 'cx.nps_submitted',
        memberId: member.id,
        payload: { score: 4 },
        idempotencyKey: `campaign-event-${Date.now()}`,
      })

      await InMemoryQueue.drain('campaign-triggers')

      const res = await request.get(`/v1/campaigns/${campaign.id}/events`)

      expect(res.status).toBe(200)
      expect(res.body.length).toBeGreaterThanOrEqual(1)

      const campaignEvent = res.body.find(
        (e: { memberId: string }) => e.memberId === member.id,
      )
      expect(campaignEvent).toBeDefined()
      expect(campaignEvent.executedAt).toBeDefined()
      expect(new Date(campaignEvent.executedAt).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('creates only one CampaignEvent when the same member triggers the same campaign twice (dedup)', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = await authenticatedRequest(brand.id)

      await request.post('/v1/events').send({
        type: 'cx.nps_submitted',
        memberId: member.id,
        payload: { score: 5 },
        idempotencyKey: `dedup-1-${Date.now()}`,
      })

      await request.post('/v1/events').send({
        type: 'cx.nps_submitted',
        memberId: member.id,
        payload: { score: 5 },
        idempotencyKey: `dedup-2-${Date.now()}`,
      })

      await InMemoryQueue.drain('campaign-triggers')

      const res = await request.get(`/v1/campaigns/${campaign.id}/events`)

      expect(res.status).toBe(200)
      const memberEvents = res.body.filter(
        (e: { memberId: string }) => e.memberId === member.id,
      )
      expect(memberEvents).toHaveLength(1)
    })

    it('records a positive latencyMs on the CampaignEvent', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = await authenticatedRequest(brand.id)

      await request.post('/v1/events').send({
        type: 'cx.nps_submitted',
        memberId: member.id,
        payload: { score: 6 },
        idempotencyKey: `latency-${Date.now()}`,
      })

      await InMemoryQueue.drain('campaign-triggers')

      const res = await request.get(`/v1/campaigns/${campaign.id}/events`)
      const campaignEvent = res.body.find(
        (e: { memberId: string }) => e.memberId === member.id,
      )

      expect(campaignEvent.latencyMs).toBeDefined()
      expect(typeof campaignEvent.latencyMs).toBe('number')
      expect(campaignEvent.latencyMs).toBeGreaterThan(0)
    })

    it('HERO SLA: CampaignEvent.latencyMs is less than 900000ms (15 minutes)', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = await authenticatedRequest(brand.id)

      const SLA_MS = 900_000 // 15 minutes in milliseconds

      await request.post('/v1/events').send({
        type: 'cx.nps_submitted',
        memberId: member.id,
        payload: { score: 2 },
        idempotencyKey: `sla-hero-${Date.now()}`,
      })

      await InMemoryQueue.drain('campaign-triggers')

      const res = await request.get(`/v1/campaigns/${campaign.id}/events`)
      const campaignEvent = res.body.find(
        (e: { memberId: string }) => e.memberId === member.id,
      )

      expect(campaignEvent.latencyMs).toBeLessThan(SLA_MS)
    })

    it('pauses a campaign automatically when spend exceeds the budgetCap', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      // budgetCap=10 means the campaign stops after 10 triggers
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
        budgetCap: 10,
        action: { type: 'AWARD_POINTS', points: 50 },
      })
      const request = await authenticatedRequest(brand.id)

      // Create 11 distinct members and trigger the campaign for each
      for (let i = 0; i < 11; i++) {
        const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
        await request.post('/v1/events').send({
          type: 'cx.nps_submitted',
          memberId: member.id,
          payload: { score: 4 },
          idempotencyKey: `budget-${i}-${Date.now()}`,
        })
      }

      await InMemoryQueue.drain('campaign-triggers')

      const campaignRes = await request.get(`/v1/campaigns/${campaign.id}`)
      expect(campaignRes.body.status).toBe('PAUSED')
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
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(2)
      expect(res.body[0].brandId).toBe(brand.id)
      expect(res.body[1].brandId).toBe(brand.id)
    })

    it('returns an empty array for a brand with no campaigns', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(0)
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
      const request = await authenticatedRequest(brandA.id)

      const res = await request.get('/v1/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(1)
      expect(res.body[0].brandId).toBe(brandA.id)
      expect(res.body.every((c: { brandId: string }) => c.brandId === brandA.id)).toBe(true)
    })
  })
})
