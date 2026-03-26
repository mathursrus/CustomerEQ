/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createMember,
  createSurvey,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Survey Lifecycle — admin CRUD + response pipeline', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ---------------------------------------------------------------------------
  // 1. Create NPS survey
  // ---------------------------------------------------------------------------

  it('creates an NPS survey in DRAFT status via POST /v1/surveys', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/surveys').send({
      name: 'Q1 NPS Survey',
      programId: program.id,
      type: 'NPS',
      questions: [
        { id: 'q1', text: 'How likely are you to recommend us? (0-10)', type: 'rating', required: true },
        { id: 'q2', text: 'What could we improve?', type: 'text', required: false },
      ],
    })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.status).toBe('DRAFT')
    expect(res.body.type).toBe('NPS')
    expect(res.body.name).toBe('Q1 NPS Survey')
    expect(res.body.brandId).toBe(brand.id)
    expect(res.body.programId).toBe(program.id)
  })

  // ---------------------------------------------------------------------------
  // 2. List surveys
  // ---------------------------------------------------------------------------

  it('lists all surveys for the brand via GET /v1/surveys', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    // Create two surveys directly via factory
    await createSurvey({ brandId: brand.id, programId: program.id, name: 'Survey A' })
    await createSurvey({ brandId: brand.id, programId: program.id, name: 'Survey B' })

    const res = await request.get('/v1/surveys')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(2)
    const names = res.body.map((s: { name: string }) => s.name)
    expect(names).toContain('Survey A')
    expect(names).toContain('Survey B')
  })

  // ---------------------------------------------------------------------------
  // 3. Activate a DRAFT survey
  // ---------------------------------------------------------------------------

  it('activates a DRAFT survey via PATCH /v1/surveys/:id/status', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    // Create survey in DRAFT status (factory defaults to ACTIVE, use createSurvey directly)
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'DRAFT',
    })

    const res = await request
      .patch(`/v1/surveys/${survey.id}/status`)
      .send({ status: 'ACTIVE' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
    expect(res.body.id).toBe(survey.id)
  })

  // ---------------------------------------------------------------------------
  // 4. Cannot activate survey without questions
  // ---------------------------------------------------------------------------

  it('rejects activation of a survey with no questions (422)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    // Create a survey with empty questions array directly in DB
    const prisma = getTestPrisma()
    const survey = await prisma.survey.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Empty Questions Survey',
        type: 'NPS',
        questions: [],
        status: 'DRAFT',
      },
    })

    const res = await request
      .patch(`/v1/surveys/${survey.id}/status`)
      .send({ status: 'ACTIVE' })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/at least one question/i)
  })

  // ---------------------------------------------------------------------------
  // 5. Submit survey response — full pipeline
  // ---------------------------------------------------------------------------

  it('submits a response, enqueues sentiment analysis and CX event', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    // Create an ACTIVE survey
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    const res = await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({
        memberId: member.id,
        answers: { q1: 8, q2: 'The product quality is really excellent overall' },
        score: 8,
        channel: 'email',
      })

    expect(res.status).toBe(201)
    expect(res.body.responseId).toBeDefined()
    expect(res.body.message).toMatch(/recorded/i)

    // Verify CX event was enqueued to loyalty-events
    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    expect(loyaltyJobs.length).toBeGreaterThanOrEqual(1)
    const cxJob = loyaltyJobs.find(
      (j) => (j.data as { eventType?: string }).eventType === 'cx.nps_response',
    )
    expect(cxJob).toBeDefined()

    // Verify sentiment analysis was enqueued (text answer > 10 chars)
    const sentimentJobs = InMemoryQueue.getJobs('sentiment-analysis')
    expect(sentimentJobs.length).toBeGreaterThanOrEqual(1)
    const sentimentJob = sentimentJobs.find(
      (j) => (j.data as { surveyResponseId?: string }).surveyResponseId === res.body.responseId,
    )
    expect(sentimentJob).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 6. Duplicate response
  // ---------------------------------------------------------------------------

  it('returns duplicate=true when the same member submits to the same survey twice', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })

    // First submission
    const first = await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 7 }, score: 7 })
    expect(first.status).toBe(201)

    // Second submission — duplicate
    const second = await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 9 }, score: 9 })

    expect(second.status).toBe(200)
    expect(second.body.duplicate).toBe(true)
    expect(second.body.responseId).toBe(first.body.responseId)
  })

  // ---------------------------------------------------------------------------
  // 7. NPS promoter event (score >= 9)
  // ---------------------------------------------------------------------------

  it('enqueues a promoter event when NPS score >= 9', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 10 }, score: 10 })

    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    const promoterJob = loyaltyJobs.find(
      (j) => (j.data as { eventType?: string }).eventType === 'cx.promoter_identified',
    )
    expect(promoterJob).toBeDefined()
    expect((promoterJob!.data as { payload?: { nps_score?: number } }).payload?.nps_score).toBe(10)
  })

  // ---------------------------------------------------------------------------
  // 8. View survey detail with response stats
  // ---------------------------------------------------------------------------

  it('returns survey detail with _count.responses and recent responses', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })

    // Submit a response
    await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 8 }, score: 8 })

    const res = await request.get(`/v1/surveys/${survey.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(survey.id)
    expect(res.body._count.responses).toBe(1)
    expect(Array.isArray(res.body.responses)).toBe(true)
    expect(res.body.responses.length).toBe(1)
    expect(res.body.responses[0].score).toBe(8)
    expect(res.body.responses[0].memberId).toBe(member.id)
  })

  // ---------------------------------------------------------------------------
  // 9. Close survey — cannot submit response to closed survey
  // ---------------------------------------------------------------------------

  it('closes a survey and rejects further responses', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })

    // Close the survey
    const closeRes = await request
      .patch(`/v1/surveys/${survey.id}/status`)
      .send({ status: 'CLOSED' })
    expect(closeRes.status).toBe(200)
    expect(closeRes.body.status).toBe('CLOSED')

    // Try to submit a response — survey is no longer ACTIVE
    const submitRes = await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 9 }, score: 9 })

    expect(submitRes.status).toBe(404)
    expect(submitRes.body.error).toMatch(/not found|not active/i)
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('rejects survey creation for a program that does not belong to the brand', async () => {
    const brand1 = await createBrand()
    const brand2 = await createBrand()
    const program2 = await createProgram({ brandId: brand2.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand1.id)

    const res = await request.post('/v1/surveys').send({
      name: 'Cross-brand attempt',
      programId: program2.id,
      type: 'NPS',
      questions: [{ id: 'q1', text: 'Rate us', type: 'rating', required: true }],
    })

    expect(res.status).toBe(404)
  })

  it('does not enqueue sentiment analysis when answers have no open-ended text', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 5 }, score: 5 })

    const sentimentJobs = InMemoryQueue.getJobs('sentiment-analysis')
    expect(sentimentJobs.length).toBe(0)
  })

  it('rejects response submission for a member without consent', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createMember({ brandId: brand.id }) // no consent
    const request = authenticatedRequest(brand.id)

    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
    })

    const res = await request
      .post(`/v1/surveys/${survey.id}/responses`)
      .send({ memberId: member.id, answers: { q1: 8 }, score: 8 })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/consent/i)
  })
})
