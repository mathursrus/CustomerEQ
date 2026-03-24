/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupTestDb,
  teardownTestDb,
  seedTestDb,
  createBrand,
  createProgram,
  createProgramWithRules,
  createConsentedMember,
  createCampaign,
  createCxEvent,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Analytics API — /v1/analytics', () => {
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
  // GET /v1/analytics/overview
  // -------------------------------------------------------------------------

  describe('GET /v1/analytics/overview', () => {
    it('returns 200 with all metrics equal to 0 when there is no data', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/overview')

      expect(res.status).toBe(200)
      expect(res.body.totalMembers).toBe(0)
      expect(res.body.totalPointsIssued).toBe(0)
      expect(res.body.totalPointsRedeemed).toBe(0)
      expect(res.body.roi).toBeDefined()
    })

    it('returns accurate totalMembers, totalPointsIssued, totalPointsRedeemed after seeding known events', async () => {
      const brand = await createBrand()
      const program = await createProgramWithRules({
        brandId: brand.id,
        status: 'ACTIVE',
        rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100 }],
      })
      const request = await authenticatedRequest(brand.id)

      // Enroll 3 members
      const member1 = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const member2 = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const member3 = await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Issue 200 points to member1 (2 events × 100 pts)
      await createCxEvent({
        brandId: brand.id,
        memberId: member1.id,
        type: 'cx.purchase_completed',
        pointsEarned: 100,
      })
      await createCxEvent({
        brandId: brand.id,
        memberId: member1.id,
        type: 'cx.purchase_completed',
        pointsEarned: 100,
      })

      // Issue 100 points to member2
      await createCxEvent({
        brandId: brand.id,
        memberId: member2.id,
        type: 'cx.purchase_completed',
        pointsEarned: 100,
      })

      // Redeem 50 points for member1
      await createCxEvent({
        brandId: brand.id,
        memberId: member1.id,
        type: 'loyalty.points_redeemed',
        pointsRedeemed: 50,
      })

      await InMemoryQueue.drain('loyalty-events')

      const res = await request.get('/v1/analytics/overview')

      expect(res.status).toBe(200)
      expect(res.body.totalMembers).toBe(3)
      expect(res.body.totalPointsIssued).toBe(300)   // 200 + 100
      expect(res.body.totalPointsRedeemed).toBe(50)
    })

    it('calculates ROI as totalPointsRedeemed / totalPointsIssued when both are non-zero', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
        pointsBalance: 0,
      })
      const request = await authenticatedRequest(brand.id)

      // Create events with known totals: issued=200, redeemed=100 → ROI=0.5
      await createCxEvent({
        brandId: brand.id,
        memberId: member.id,
        type: 'cx.purchase_completed',
        pointsEarned: 200,
      })
      await createCxEvent({
        brandId: brand.id,
        memberId: member.id,
        type: 'loyalty.points_redeemed',
        pointsRedeemed: 100,
      })

      await InMemoryQueue.drain('loyalty-events')

      const res = await request.get('/v1/analytics/overview')

      expect(res.status).toBe(200)
      expect(res.body.totalPointsIssued).toBe(200)
      expect(res.body.totalPointsRedeemed).toBe(100)
      // ROI = redeemed / issued = 0.5 (±0.01 tolerance for floating point)
      expect(res.body.roi).toBeCloseTo(0.5, 2)
    })

    it('excludes events outside the specified date range', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const oldDate = new Date('2025-01-01T00:00:00Z')
      const recentDate = new Date()

      // Create an old event (outside range)
      await createCxEvent({
        brandId: brand.id,
        memberId: member.id,
        type: 'cx.purchase_completed',
        pointsEarned: 500,
        createdAt: oldDate,
      })

      // Create a recent event (inside range)
      await createCxEvent({
        brandId: brand.id,
        memberId: member.id,
        type: 'cx.purchase_completed',
        pointsEarned: 75,
        createdAt: recentDate,
      })

      await InMemoryQueue.drain('loyalty-events')

      const startOfYear = new Date()
      startOfYear.setFullYear(startOfYear.getFullYear() - 1, 0, 1)

      const res = await request
        .get('/v1/analytics/overview')
        .query({ from: startOfYear.toISOString(), to: new Date().toISOString() })

      expect(res.status).toBe(200)
      // Only the recent event should be counted — the old one is outside range
      expect(res.body.totalPointsIssued).toBe(75)
    })

    it('completes the overview query in less than 3000ms', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const start = Date.now()
      const res = await request.get('/v1/analytics/overview')
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(3000)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/analytics/campaigns
  // -------------------------------------------------------------------------

  describe('GET /v1/analytics/campaigns', () => {
    it('returns per-campaign event count and total points awarded', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const campaign = await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
        action: { type: 'AWARD_POINTS', points: 150 },
      })
      const request = await authenticatedRequest(brand.id)

      // Trigger the campaign 3 times with 3 different members
      for (let i = 0; i < 3; i++) {
        const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
        await request.post('/v1/events').send({
          type: 'cx.nps_submitted',
          memberId: member.id,
          payload: { score: 5 },
          idempotencyKey: `campaign-analytics-${i}-${Date.now()}`,
        })
      }

      await InMemoryQueue.drain('campaign-triggers')
      await InMemoryQueue.drain('loyalty-events')

      const res = await request.get('/v1/analytics/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)

      const campaignStats = res.body.find(
        (c: { campaignId: string }) => c.campaignId === campaign.id,
      )
      expect(campaignStats).toBeDefined()
      expect(campaignStats.eventCount).toBe(3)
      expect(campaignStats.totalPointsAwarded).toBe(450) // 3 × 150
    })

    it('returns empty array when no campaigns have been triggered', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      // May be empty or contain zero-count entries for this brand
      const nonZeroEntries = res.body.filter(
        (c: { eventCount: number }) => c.eventCount > 0,
      )
      expect(nonZeroEntries).toHaveLength(0)
    })

    it('completes the campaigns analytics query in less than 3000ms', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const start = Date.now()
      const res = await request.get('/v1/analytics/campaigns')
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(3000)
    })
  })
})
