/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createErasedMember,
  createLoyaltyEvent,
  createSurvey,
  createSurveyResponse,
  createReward,
  createRedemption,
  createCampaign,
  createCampaignEvent,
  createConversation,
  createTier,
  createExternalSignalSource,
  createExternalSignal,
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

  // -------------------------------------------------------------------------
  // GET /v1/members/:id/360 — Customer 360 (Issue #98)
  // -------------------------------------------------------------------------

  describe('GET /v1/members/:id/360', () => {
    it('returns 200 with all sub-collections populated', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Create related data
      await createLoyaltyEvent({ brandId: brand.id, memberId: member.id, eventType: 'purchase', pointsEarned: 100 })
      await createLoyaltyEvent({ brandId: brand.id, memberId: member.id, eventType: 'survey_complete', pointsEarned: 50 })

      const survey = await createSurvey({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, score: 9, sentiment: 0.8, topics: ['service'] })

      const reward = await createReward({ brandId: brand.id, programId: program.id })
      await createRedemption({ brandId: brand.id, memberId: member.id, rewardId: reward.id, pointsSpent: 200 })

      const campaign = await createCampaign({ brandId: brand.id, programId: program.id })
      await createCampaignEvent({ brandId: brand.id, campaignId: campaign.id, memberId: member.id })
      const source = await createExternalSignalSource({ brandId: brand.id, name: 'Flagship Reviews' })
      await createExternalSignal({
        brandId: brand.id,
        sourceId: source.id,
        memberId: member.id,
        sourceType: 'GENERIC_WEBHOOK',
        body: 'Packaging arrived damaged.',
        subjectLabel: 'Starter Kit',
        externalAuthorLabel: 'reviewer-1',
      })

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.member.id).toBe(member.id)
      expect(res.body.member.email).toBe(member.email)
      expect(res.body.member.pointsBalance).toBe(0)

      // Sub-collections
      expect(res.body.recentEvents.items).toHaveLength(2)
      expect(res.body.recentEvents.hasMore).toBe(false)
      expect(res.body.recentEvents.total).toBe(2)

      expect(res.body.surveyResponses.items).toHaveLength(1)
      expect(res.body.surveyResponses.items[0].score).toBe(9)

      expect(res.body.redemptions.items).toHaveLength(1)
      expect(res.body.redemptions.items[0].pointsSpent).toBe(200)

      expect(res.body.campaignEvents.items).toHaveLength(1)
      expect(res.body.externalSignals.items).toHaveLength(1)
      expect(res.body.externalSignals.items[0].sourceName).toBe('Flagship Reviews')

      // Stats
      expect(res.body.stats.totalEvents).toBe(2)
      expect(res.body.stats.totalSurveyResponses).toBe(1)
      expect(res.body.stats.totalPointsEarned).toBe(150)
    })

    it('returns 200 with empty sub-collections for a new member', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.recentEvents.items).toHaveLength(0)
      expect(res.body.recentEvents.hasMore).toBe(false)
      expect(res.body.recentEvents.total).toBe(0)
      expect(res.body.surveyResponses.items).toHaveLength(0)
      expect(res.body.redemptions.items).toHaveLength(0)
      expect(res.body.campaignEvents.items).toHaveLength(0)
      expect(res.body.externalSignals.items).toHaveLength(0)
      expect(res.body.openCases).toHaveLength(0)
      expect(res.body.openConversations).toHaveLength(0)
      expect(res.body.stats.totalEvents).toBe(0)
      expect(res.body.stats.averageSentiment).toBeNull()
    })

    it('returns open support conversations (ACTIVE/WAITING_ON_CUSTOMER/ESCALATED) but excludes RESOLVED/CLOSED', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })

      const active = await createConversation({ brandId: brand.id, memberId: member.id, status: 'ACTIVE', intent: 'billing', topic: 'refund' })
      const waiting = await createConversation({ brandId: brand.id, memberId: member.id, status: 'WAITING_ON_CUSTOMER' })
      const escalated = await createConversation({ brandId: brand.id, memberId: member.id, status: 'ESCALATED', assignee: 'agent@example.com' })
      await createConversation({ brandId: brand.id, memberId: member.id, status: 'RESOLVED' })
      await createConversation({ brandId: brand.id, memberId: member.id, status: 'CLOSED' })

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.openConversations).toHaveLength(3)
      const ids = res.body.openConversations.map((c: { id: string }) => c.id).sort()
      expect(ids).toEqual([active.id, waiting.id, escalated.id].sort())

      const activeResult = res.body.openConversations.find((c: { id: string }) => c.id === active.id)
      expect(activeResult).toMatchObject({
        status: 'ACTIVE',
        intent: 'billing',
        topic: 'refund',
        messageCount: 0,
      })

      const escalatedResult = res.body.openConversations.find((c: { id: string }) => c.id === escalated.id)
      expect(escalatedResult.assignee).toBe('agent@example.com')
    })

    it('does not return conversations from other members or brands', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      const program = await createProgram({ brandId: brandA.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brandA.id, programId: program.id })
      const otherMember = await createConsentedMember({ brandId: brandA.id, programId: program.id })
      const programB = await createProgram({ brandId: brandB.id, status: 'ACTIVE' })
      const brandBMember = await createConsentedMember({ brandId: brandB.id, programId: programB.id })

      await createConversation({ brandId: brandA.id, memberId: otherMember.id, status: 'ACTIVE' })
      await createConversation({ brandId: brandB.id, memberId: brandBMember.id, status: 'ACTIVE' })
      const mine = await createConversation({ brandId: brandA.id, memberId: member.id, status: 'ACTIVE' })

      const request = authenticatedRequest(brandA.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.openConversations).toHaveLength(1)
      expect(res.body.openConversations[0].id).toBe(mine.id)
    })

    it('masks PII for erased members', async () => {
      const brand = await createBrand()
      const member = await createErasedMember({ brandId: brand.id })

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.member.email).toBe('[ERASED]')
      expect(res.body.member.firstName).toBe('[ERASED]')
      expect(res.body.member.lastName).toBe('[ERASED]')
      expect(res.body.member.phone).toBe('[ERASED]')
    })

    it('returns 404 for non-existent member', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/members/00000000-0000-0000-0000-000000000000/360')

      expect(res.status).toBe(404)
    })

    it('returns 404 when accessing member from different brand (tenant isolation)', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      const program = await createProgram({ brandId: brandA.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brandA.id, programId: program.id })

      const request = authenticatedRequest(brandB.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(404)
    })

    it('respects eventsLimit parameter and sets hasMore', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Create 5 events
      for (let i = 0; i < 5; i++) {
        await createLoyaltyEvent({ brandId: brand.id, memberId: member.id, eventType: 'purchase', pointsEarned: 10 })
      }

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360?eventsLimit=3`)

      expect(res.status).toBe(200)
      expect(res.body.recentEvents.items).toHaveLength(3)
      expect(res.body.recentEvents.hasMore).toBe(true)
      expect(res.body.recentEvents.total).toBe(5)
    })

    it('excludes unmatched external signals from customer 360', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const source = await createExternalSignalSource({ brandId: brand.id, name: 'Public Reviews' })

      await createExternalSignal({
        brandId: brand.id,
        sourceId: source.id,
        memberId: null,
        matchStatus: 'UNMATCHED',
        body: 'Public comment with no known member.',
      })

      const request = authenticatedRequest(brand.id)
      const res = await request.get(`/v1/members/${member.id}/360`)

      expect(res.status).toBe(200)
      expect(res.body.externalSignals.items).toHaveLength(0)
      expect(res.body.externalSignals.total).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members — Search (Issue #98)
  // -------------------------------------------------------------------------

  describe('GET /v1/members (search)', () => {
    it('returns paginated results with default params', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'Alice' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'Bob' })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(2)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(20)
      expect(res.body.totalPages).toBe(1)
    })

    it('searches by name (text search q param)', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'Alice', lastName: 'Wonder' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'Bob', lastName: 'Builder' })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?q=ali')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].firstName).toBe('Alice')
    })

    it('searches by email', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, email: 'unique-search@test.com' })
      await createConsentedMember({ brandId: brand.id, programId: program.id })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?q=unique-search')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].email).toBe('unique-search@test.com')
    })

    it('filters by status', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createErasedMember({ brandId: brand.id })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?status=ERASED')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].status).toBe('ERASED')
      // PII masked for erased member
      expect(res.body.data[0].email).toBe('[ERASED]')
      expect(res.body.data[0].firstName).toBe('[ERASED]')
    })

    it('filters by points balance range', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 500 })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 1500 })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 3000 })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?balanceMin=1000&balanceMax=2000')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].pointsBalance).toBe(1500)
    })

    it('paginates correctly with page and pageSize', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      for (let i = 0; i < 7; i++) {
        await createConsentedMember({ brandId: brand.id, programId: program.id })
      }

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?page=2&pageSize=3')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(3)
      expect(res.body.total).toBe(7)
      expect(res.body.page).toBe(2)
      expect(res.body.totalPages).toBe(3) // ceil(7/3)
    })

    it('filters by tier name', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const goldTier = await createTier({ brandId: brand.id, programId: program.id, name: 'Gold', rank: 2 })
      const memberA = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Assign tier
      const prisma = getTestPrisma()
      await prisma.member.update({ where: { id: memberA.id }, data: { currentTierId: goldTier.id } })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?tier=Gold')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].tierName).toBe('Gold')
    })

    it('filters by NPS score range via survey responses', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id })

      const happyMember = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: happyMember.id, brandId: brand.id, score: 9 })

      const sadMember = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: sadMember.id, brandId: brand.id, score: 3 })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?npsMin=8')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].id).toBe(happyMember.id)
    })

    it('enforces brand isolation in search', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      const programA = await createProgram({ brandId: brandA.id, status: 'ACTIVE' })
      const programB = await createProgram({ brandId: brandB.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brandA.id, programId: programA.id })
      await createConsentedMember({ brandId: brandB.id, programId: programB.id })

      const request = authenticatedRequest(brandA.id)
      const res = await request.get('/v1/members')

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1) // Only brandA's member
    })

    it('excludes soft-deleted members', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createConsentedMember({ brandId: brand.id, programId: program.id })

      // Soft-delete one member
      const prisma = getTestPrisma()
      await prisma.member.update({ where: { id: member.id }, data: { deletedAt: new Date() } })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members')

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1) // Soft-deleted excluded
    })

    it('sorts by pointsBalance ascending', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 300 })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 100 })
      await createConsentedMember({ brandId: brand.id, programId: program.id, pointsBalance: 200 })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?sortBy=pointsBalance&sortOrder=asc')

      expect(res.status).toBe(200)
      const balances = res.body.data.map((m: { pointsBalance: number }) => m.pointsBalance)
      expect(balances).toEqual([100, 200, 300])
    })

    it('filters by enrolledAfter date', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const oldMember = await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'Old' })
      await createConsentedMember({ brandId: brand.id, programId: program.id, firstName: 'New' })

      // Backdate the first member's createdAt
      const prisma = getTestPrisma()
      await prisma.member.update({
        where: { id: oldMember.id },
        data: { createdAt: new Date('2024-01-01T00:00:00.000Z') },
      })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?enrolledAfter=2025-01-01T00:00:00.000Z')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].firstName).toBe('New')
    })

    it('filters by sentimentMin via survey responses', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id })

      const positiveMember = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: positiveMember.id, brandId: brand.id, sentiment: 0.8 })

      const negativeMember = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: negativeMember.id, brandId: brand.id, sentiment: -0.5 })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?sentimentMin=0.5')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].id).toBe(positiveMember.id)
    })

    it('sorts by sentiment descending', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id })

      const memberA = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: memberA.id, brandId: brand.id, sentiment: 0.2 })

      const memberB = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: memberB.id, brandId: brand.id, sentiment: 0.9 })

      const memberC = await createConsentedMember({ brandId: brand.id, programId: program.id })
      await createSurveyResponse({ surveyId: survey.id, memberId: memberC.id, brandId: brand.id, sentiment: -0.3 })

      const request = authenticatedRequest(brand.id)
      const res = await request.get('/v1/members?sortBy=sentiment&sortOrder=desc')

      expect(res.status).toBe(200)
      const sentiments = res.body.data.map((m: { latestSentiment: number | null }) => m.latestSentiment)
      expect(sentiments).toEqual([0.9, 0.2, -0.3])
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/members/:id/360 — Aggregate accuracy tests (Bug fixes)
  // -------------------------------------------------------------------------

  describe('GET /v1/members/:id/360 — aggregate accuracy', () => {
    it('computes totalPointsRedeemed from all redemptions, not just the page limit', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const reward = await createReward({ brandId: brand.id, programId: program.id })

      // Create 5 redemptions of 100 points each = 500 total
      for (let i = 0; i < 5; i++) {
        await createRedemption({ brandId: brand.id, memberId: member.id, rewardId: reward.id, pointsSpent: 100 })
      }

      const request = authenticatedRequest(brand.id)
      // Request with redemptionsLimit=2 — only 2 items returned, but total should be 500
      const res = await request.get(`/v1/members/${member.id}/360?redemptionsLimit=2`)

      expect(res.status).toBe(200)
      expect(res.body.redemptions.items).toHaveLength(2)
      expect(res.body.redemptions.hasMore).toBe(true)
      expect(res.body.redemptions.total).toBe(5)
      // The stat must reflect ALL 5 redemptions, not just the 2 on the page
      expect(res.body.stats.totalPointsRedeemed).toBe(500)
    })

    it('computes averageSentiment from all surveys, not just the page limit', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id })

      // Create 4 survey responses: sentiments = 0.8, 0.6, 0.4, 0.2 => avg = 0.5
      const sentiments = [0.8, 0.6, 0.4, 0.2]
      for (const sentiment of sentiments) {
        await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, sentiment, score: 8 })
      }

      const request = authenticatedRequest(brand.id)
      // Request with surveysLimit=2 — only 2 items returned, but average should cover all 4
      const res = await request.get(`/v1/members/${member.id}/360?surveysLimit=2`)

      expect(res.status).toBe(200)
      expect(res.body.surveyResponses.items).toHaveLength(2)
      expect(res.body.surveyResponses.hasMore).toBe(true)
      expect(res.body.surveyResponses.total).toBe(4)
      // Average must be computed from all 4 responses: (0.8+0.6+0.4+0.2)/4 = 0.5
      expect(res.body.stats.averageSentiment).toBeCloseTo(0.5, 1)
    })
  })

})
