/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createMember,
  createSurvey,
  unauthenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Public Survey Flow — unauthenticated survey submission', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ---------------------------------------------------------------------------
  // 1. Load public survey (ACTIVE only)
  // ---------------------------------------------------------------------------

  it('loads an active survey via GET /v1/public/surveys/:id with expected fields', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      incentivePoints: 50,
    })
    const request = unauthenticatedRequest()

    const res = await request.get(`/v1/public/surveys/${survey.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(survey.id)
    expect(res.body.name).toBeDefined()
    expect(res.body.type).toBeDefined()
    expect(Array.isArray(res.body.questions)).toBe(true)
    expect(res.body.questions.length).toBeGreaterThan(0)
    expect(res.body.incentivePoints).toBe(50)
    expect(res.body.brand).toBeDefined()
    expect(res.body.brand.name).toBe(brand.name)
  })

  // ---------------------------------------------------------------------------
  // 2. Inactive (DRAFT) survey returns 404
  // ---------------------------------------------------------------------------

  it('returns 404 for a DRAFT survey on the public endpoint', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'DRAFT',
    })
    const request = unauthenticatedRequest()

    const res = await request.get(`/v1/public/surveys/${survey.id}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found|not active/i)
  })

  // ---------------------------------------------------------------------------
  // 3. Submit response by email
  // ---------------------------------------------------------------------------

  it('submits a response via email lookup on POST /v1/public/surveys/:id/respond', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({
      brandId: brand.id,
      email: 'jane@example.com',
    })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })
    const request = unauthenticatedRequest()

    const res = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'jane@example.com',
        answers: { q1: 9, q2: 'Absolutely love the product experience' },
        score: 9,
      })

    expect(res.status).toBe(201)
    expect(res.body.responseId).toBeDefined()
    expect(res.body.message).toBeDefined()

    // Verify the response was persisted
    const prisma = getTestPrisma()
    const dbResponse = await prisma.surveyResponse.findUnique({
      where: { id: res.body.responseId },
    })
    expect(dbResponse).not.toBeNull()
    expect(dbResponse!.memberId).toBe(member.id)
    expect(dbResponse!.score).toBe(9)
  })

  // ---------------------------------------------------------------------------
  // 4. Unknown email returns 404
  // ---------------------------------------------------------------------------

  it('returns 404 when the email does not match any member', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })
    const request = unauthenticatedRequest()

    const res = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'nobody@nowhere.com',
        answers: { q1: 5 },
        score: 5,
      })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  // ---------------------------------------------------------------------------
  // 5. Member without consent returns 422
  // ---------------------------------------------------------------------------

  it('returns 422 when the member has not given consent', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createMember({
      brandId: brand.id,
      email: 'noconsent@example.com',
    }) // no consent
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })
    const request = unauthenticatedRequest()

    const res = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'noconsent@example.com',
        answers: { q1: 7 },
        score: 7,
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/consent/i)
  })

  // ---------------------------------------------------------------------------
  // 6. Duplicate response
  // ---------------------------------------------------------------------------

  it('returns duplicate=true when the same email submits to the same survey twice', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({
      brandId: brand.id,
      email: 'repeat@example.com',
    })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })
    const request = unauthenticatedRequest()

    // First submission
    const first = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'repeat@example.com', answers: { q1: 8 }, score: 8 })
    expect(first.status).toBe(201)

    // Second submission — duplicate
    const second = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'repeat@example.com', answers: { q1: 10 }, score: 10 })

    expect(second.status).toBe(200)
    expect(second.body.duplicate).toBe(true)
    expect(second.body.responseId).toBe(first.body.responseId)
  })

  // ---------------------------------------------------------------------------
  // 7. Incentive points in response
  // ---------------------------------------------------------------------------

  it('includes incentivePoints in the response when the survey has them', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({
      brandId: brand.id,
      email: 'incentive@example.com',
    })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      incentivePoints: 200,
    })
    const request = unauthenticatedRequest()

    const res = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'incentive@example.com',
        answers: { q1: 7 },
        score: 7,
      })

    expect(res.status).toBe(201)
    expect(res.body.incentivePoints).toBe(200)

    // Verify incentive event was also enqueued
    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    const incentiveJob = loyaltyJobs.find(
      (j) => (j.data as { payload?: { incentive?: boolean } }).payload?.incentive === true,
    )
    expect(incentiveJob).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 8. Sentiment analysis enqueued for text answers
  // ---------------------------------------------------------------------------

  it('enqueues sentiment analysis when the response contains open-ended text', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({
      brandId: brand.id,
      email: 'feedback@example.com',
    })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })
    const request = unauthenticatedRequest()

    const res = await request
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'feedback@example.com',
        answers: {
          q1: 6,
          q2: 'The shipping was incredibly slow and customer support was unresponsive',
        },
        score: 6,
      })

    expect(res.status).toBe(201)

    const sentimentJobs = InMemoryQueue.getJobs('sentiment-analysis')
    expect(sentimentJobs.length).toBeGreaterThanOrEqual(1)

    const job = sentimentJobs.find(
      (j) => (j.data as { surveyResponseId?: string }).surveyResponseId === res.body.responseId,
    )
    expect(job).toBeDefined()
    expect((job!.data as { text?: string }).text).toContain('shipping was incredibly slow')
  })

  // ---------------------------------------------------------------------------
  // Edge: CLOSED survey not loadable publicly
  // ---------------------------------------------------------------------------

  it('returns 404 for a CLOSED survey on the public endpoint', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'CLOSED',
    })
    const request = unauthenticatedRequest()

    const res = await request.get(`/v1/public/surveys/${survey.id}`)

    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Edge: Submit to non-existent survey returns 404
  // ---------------------------------------------------------------------------

  it('returns 404 when submitting to a non-existent survey', async () => {
    const request = unauthenticatedRequest()

    const res = await request
      .post('/v1/public/surveys/fake-survey-id/respond')
      .send({
        memberEmail: 'someone@example.com',
        answers: { q1: 5 },
        score: 5,
      })

    expect(res.status).toBe(404)
  })
})

// =============================================================================
// Issue #80: Response-to-Action Rule Wiring
// =============================================================================

describe('Response-to-Action Rule Wiring — survey rule evaluation on submission', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  it('matching rule enqueues a campaign trigger', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, email: 'respondent@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

    // Create a campaign and survey rule that matches score 3 (detractor range 0–6)
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Detractor Recovery',
        triggerType: 'cx.survey_response',
        triggerCondition: { surveyId: survey.id, scoreMin: 0, scoreMax: 6 },
        actionType: 'award_points',
        actionConfig: { points: 100 },
        status: 'ACTIVE',
        startDate: new Date(),
        surveyId: survey.id,
      },
    })
    await prisma.surveyRule.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        campaignId: campaign.id,
        scoreMin: 0,
        scoreMax: 6,
        actionType: 'award_points',
        actionConfig: { points: 100 },
        ruleLabel: 'Detractors',
      },
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'respondent@example.com', answers: { q1: 3 }, score: 3 })

    expect(res.status).toBe(201)

    // Allow the non-blocking rule evaluation to run
    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    expect(triggerJobs.length).toBeGreaterThanOrEqual(1)
    const job = triggerJobs.find(
      (j) => (j.data as { campaignId?: string }).campaignId === campaign.id,
    )
    expect(job).toBeDefined()
    expect((job!.data as { surveyResponseId?: string }).surveyResponseId).toBe(res.body.responseId)
  })

  it('non-matching rule does NOT enqueue a campaign trigger', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'promoter@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

    // Rule only matches detractors (0–6), but score is 9 (promoter)
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Detractor Only',
        triggerType: 'cx.survey_response',
        triggerCondition: { surveyId: survey.id, scoreMin: 0, scoreMax: 6 },
        actionType: 'award_points',
        actionConfig: { points: 100 },
        status: 'ACTIVE',
        startDate: new Date(),
        surveyId: survey.id,
      },
    })
    await prisma.surveyRule.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        campaignId: campaign.id,
        scoreMin: 0,
        scoreMax: 6,
        actionType: 'award_points',
        actionConfig: { points: 100 },
      },
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'promoter@example.com', answers: { q1: 9 }, score: 9 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matchedJob = triggerJobs.find(
      (j) => (j.data as { campaignId?: string }).campaignId === campaign.id,
    )
    expect(matchedJob).toBeUndefined()
  })

  it('boundary score (scoreMax exact match) IS matched', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'boundary@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Boundary Test',
        triggerType: 'cx.survey_response',
        triggerCondition: { surveyId: survey.id, scoreMin: 0, scoreMax: 6 },
        actionType: 'award_points',
        actionConfig: { points: 50 },
        status: 'ACTIVE',
        startDate: new Date(),
        surveyId: survey.id,
      },
    })
    await prisma.surveyRule.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        campaignId: campaign.id,
        scoreMin: 0,
        scoreMax: 6,
        actionType: 'award_points',
        actionConfig: { points: 50 },
      },
    })

    // Score exactly at scoreMax boundary (6)
    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'boundary@example.com', answers: { q1: 6 }, score: 6 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matched = triggerJobs.find((j) => (j.data as { campaignId?: string }).campaignId === campaign.id)
    expect(matched).toBeDefined()
  })

  it('no rules seeded → no campaign trigger enqueued', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'norules@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'norules@example.com', answers: { q1: 5 }, score: 5 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    expect(triggerJobs.length).toBe(0)
  })

  it('INACTIVE campaign rule is skipped even when score matches', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'inactive@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

    // Campaign is PAUSED — rule should not trigger
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Paused Campaign',
        triggerType: 'cx.survey_response',
        triggerCondition: { surveyId: survey.id, scoreMin: 0, scoreMax: 10 },
        actionType: 'award_points',
        actionConfig: { points: 100 },
        status: 'PAUSED',
        startDate: new Date(),
        surveyId: survey.id,
      },
    })
    await prisma.surveyRule.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        campaignId: campaign.id,
        scoreMin: 0,
        scoreMax: 10,
        actionType: 'award_points',
        actionConfig: { points: 100 },
      },
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberEmail: 'inactive@example.com', answers: { q1: 4 }, score: 4 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matched = triggerJobs.find((j) => (j.data as { campaignId?: string }).campaignId === campaign.id)
    expect(matched).toBeUndefined()
  })
})
