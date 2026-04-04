/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createProgramWithRules,
  createConsentedMember,
  createLoyaltyEvent,
  createCampaign,
  createNpsSurvey,
  createSurveyResponse,
  createRedemption,
  createReward,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Analytics API — /v1/analytics', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // Helper: get a wide date range that covers all test data
  function dateRangeParams() {
    const startDate = new Date('2020-01-01T00:00:00Z').toISOString()
    const endDate = new Date('2030-12-31T23:59:59Z').toISOString()
    return { startDate, endDate }
  }

  // -------------------------------------------------------------------------
  // GET /v1/analytics/overview
  // -------------------------------------------------------------------------

  describe('GET /v1/analytics/overview', () => {
    it('returns 200 with all metrics equal to 0 when there is no data', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/overview').query(dateRangeParams())

      expect(res.status).toBe(200)
      expect(res.body.totalMembers).toBe(0)
      expect(res.body.totalPointsIssued).toBe(0)
      expect(res.body.totalPointsRedeemed).toBe(0)
      expect(res.body.roi).toBeDefined()
    })

    it('returns accurate totalMembers, totalPointsIssued, totalPointsRedeemed after seeding known events', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      // Enroll 3 members
      const member1 = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const member2 = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const member3 = await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Issue 200 points to member1 (2 events x 100 pts)
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member1.id,
        eventType: 'cx.purchase_completed',
        pointsEarned: 100,
      })
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member1.id,
        eventType: 'cx.purchase_completed',
        pointsEarned: 100,
      })

      // Issue 100 points to member2
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member2.id,
        eventType: 'cx.purchase_completed',
        pointsEarned: 100,
      })

      // Redeem 50 points for member1 (negative pointsEarned represents redemption)
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member1.id,
        eventType: 'loyalty.points_redeemed',
        pointsEarned: -50,
      })

      const res = await request.get('/v1/analytics/overview').query(dateRangeParams())

      expect(res.status).toBe(200)
      // totalMembers counts distinct members in loyalty_events
      // member3 has no events so won't be counted
      expect(res.body.totalMembers).toBe(2)
      expect(res.body.totalPointsIssued).toBe(300)   // 200 + 100
      expect(res.body.totalPointsRedeemed).toBe(50)
    })

    it('calculates ROI based on totalPointsRedeemed / totalPointsIssued * 100 when both are non-zero', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
      })
      const request = authenticatedRequest(brand.id)

      // Create events with known totals: issued=200, redeemed=100
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member.id,
        eventType: 'cx.purchase_completed',
        pointsEarned: 200,
      })
      await createLoyaltyEvent({
        brandId: brand.id,
        memberId: member.id,
        eventType: 'loyalty.points_redeemed',
        pointsEarned: -100,
      })

      const res = await request.get('/v1/analytics/overview').query(dateRangeParams())

      expect(res.status).toBe(200)
      expect(res.body.totalPointsIssued).toBe(200)
      expect(res.body.totalPointsRedeemed).toBe(100)
      // ROI = (redeemed / issued) * 100 = 50.0
      expect(res.body.roi).toBeCloseTo(50, 0)
    })

    it('completes the overview query in less than 3000ms', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const start = Date.now()
      const res = await request.get('/v1/analytics/overview').query(dateRangeParams())
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(3000)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/analytics/campaigns
  // -------------------------------------------------------------------------

  describe('GET /v1/analytics/campaigns', () => {
    it('returns per-campaign stats including event counts', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createCampaign({
        brandId: brand.id,
        programId: program.id,
        status: 'ACTIVE',
        triggerEventType: 'cx.nps_submitted',
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      // At least our one campaign should appear
      expect(res.body.length).toBeGreaterThanOrEqual(1)
      expect(res.body[0].id).toBeDefined()
      expect(res.body[0].name).toBeDefined()
      expect(res.body[0].eventsTriggered).toBeDefined()
    })

    it('returns an array (possibly empty or with zero-count entries) when no campaigns have been triggered', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/campaigns')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('completes the campaigns analytics query in less than 3000ms', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const start = Date.now()
      const res = await request.get('/v1/analytics/campaigns')
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(3000)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/analytics/program-health
  // -------------------------------------------------------------------------

  describe('GET /v1/analytics/program-health', () => {
    it('returns 200 with correct shape for an empty brand', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/analytics/program-health')

      expect(res.status).toBe(200)
      expect(res.body.cxHealth).toBeDefined()
      expect(res.body.loyaltyHealth).toBeDefined()
      expect(Array.isArray(res.body.insights)).toBe(true)
      expect(res.body.cxHealth.atRiskCount).toBe(0)
      expect(res.body.cxHealth.activeSurveys).toBe(0)
      expect(res.body.loyaltyHealth.activeMembers).toBe(0)
      expect(res.body.loyaltyHealth.pointsIssuedThisWeek).toBe(0)
      expect(res.body.insights).toHaveLength(0)
    })

    it('returns correct avgNps and atRiskCount from seeded NPS responses', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createNpsSurvey({ brandId: brand.id, programId: program.id })
      const request = authenticatedRequest(brand.id)

      // 5 detractors (score < 7), 1 promoter (score >= 9)
      for (let i = 0; i < 5; i++) {
        const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
        await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, score: 4 })
      }
      const promoterMember = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: promoterMember.id, brandId: brand.id, score: 9 })

      const res = await request.get('/v1/analytics/program-health')

      expect(res.status).toBe(200)
      expect(res.body.cxHealth.atRiskCount).toBe(5)
      // avgNps: (1 promoter - 5 detractors) / 6 total * 100 = -67
      expect(res.body.cxHealth.avgNps).toBeLessThan(0)
    })

    it('returns correct pointsIssuedThisWeek from seeded loyalty events', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = authenticatedRequest(brand.id)

      await createLoyaltyEvent({ brandId: brand.id, memberId: member.id, eventType: 'cx.purchase_completed', pointsEarned: 200 })
      await createLoyaltyEvent({ brandId: brand.id, memberId: member.id, eventType: 'cx.purchase_completed', pointsEarned: 150 })

      const res = await request.get('/v1/analytics/program-health')

      expect(res.status).toBe(200)
      expect(res.body.loyaltyHealth.pointsIssuedThisWeek).toBe(350)
    })

    it('surfaces detractors-no-redemption insight when detractors have no recent redemption', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createNpsSurvey({ brandId: brand.id, programId: program.id })
      const request = authenticatedRequest(brand.id)

      // Create 5 detractors with no redemptions
      for (let i = 0; i < 5; i++) {
        const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
        await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, score: 3 })
      }

      const res = await request.get('/v1/analytics/program-health')

      expect(res.status).toBe(200)
      const detractorInsight = res.body.insights.find((i: { id: string }) => i.id === 'detractors-no-redemption')
      expect(detractorInsight).toBeDefined()
      expect(detractorInsight.message).toContain('5')
      expect(detractorInsight.ctaHref).toBe('/admin/campaigns/new?filter=detractors&maxNps=6')
    })

    it('does NOT surface detractors insight when detractors have redeemed recently', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createNpsSurvey({ brandId: brand.id, programId: program.id })
      const reward = await createReward({ brandId: brand.id, programId: program.id, pointsCost: 100 })
      const request = authenticatedRequest(brand.id)

      // Create 5 detractors who have redeemed
      for (let i = 0; i < 5; i++) {
        const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
        await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, score: 3 })
        await createRedemption({ brandId: brand.id, memberId: member.id, rewardId: reward.id, pointsSpent: 100 })
      }

      const res = await request.get('/v1/analytics/program-health')

      expect(res.status).toBe(200)
      const detractorInsight = res.body.insights.find((i: { id: string }) => i.id === 'detractors-no-redemption')
      expect(detractorInsight).toBeUndefined()
    })

    it('completes in less than 3000ms', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const start = Date.now()
      const res = await request.get('/v1/analytics/program-health')
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(3000)
    })
  })
})
