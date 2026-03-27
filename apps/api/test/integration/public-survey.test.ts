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
