/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createSurvey,
  unauthenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Public Survey Flow — POST /v1/public/surveys/:id/respond (Issue #231 PR2)', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ---------------------------------------------------------------------------
  // GET /v1/public/surveys/:id — survey metadata
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

    const res = await unauthenticatedRequest().get(`/v1/public/surveys/${survey.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(survey.id)
    expect(res.body.brand.name).toBe(brand.name)
    expect(res.body.incentivePoints).toBe(50)
  })

  it('returns 404 for a DRAFT survey on the public endpoint', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })

    const res = await unauthenticatedRequest().get(`/v1/public/surveys/${survey.id}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for a CLOSED survey on the public endpoint', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'CLOSED' })

    const res = await unauthenticatedRequest().get(`/v1/public/surveys/${survey.id}`)
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Existing-member submit (legacy memberEmail field still works as memberId)
  // ---------------------------------------------------------------------------

  it('existing member — submits via legacy memberEmail and returns the new response shape', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, email: 'jane@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberEmail: 'jane@example.com',
        answers: { q1: 9, q2: 'Loved it' },
        score: 9,
      })

    expect(res.status).toBe(201)
    expect(res.body.surveyResponseId).toBeDefined()
    expect(res.body.memberId).toBe(member.id)
    expect(res.body.autoEnrolled).toBe(false)
    expect(res.body.enrolledVia).toBeNull()
    expect(res.body.responsePolicy).toBe('MULTIPLE')

    const prisma = getTestPrisma()
    const dbResponse = await prisma.surveyResponse.findUnique({
      where: { id: res.body.surveyResponseId },
    })
    expect(dbResponse?.memberId).toBe(member.id)
    expect(dbResponse?.score).toBe(9)
  })

  // ---------------------------------------------------------------------------
  // Auto-enroll: SURVEY_RESPONSE channel (body-supplied identifier)
  // ---------------------------------------------------------------------------

  it('auto-enrolls a new member when memberId comes from request body — enrolledVia = SURVEY_RESPONSE', async () => {
    // IMPLIED_ON_SUBMIT brand bypasses the explicit-consent boolean requirement
    // so we can exercise the auto-enroll path in isolation.
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberId: 'newbie@example.com',
        firstName: 'New',
        lastName: 'Bie',
        answers: { q1: 10 },
        score: 10,
      })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(true)
    expect(res.body.enrolledVia).toBe('SURVEY_RESPONSE')

    const prisma = getTestPrisma()
    const member = await prisma.member.findUnique({
      where: { brandId_externalId: { brandId: brand.id, externalId: 'newbie@example.com' } },
    })
    expect(member).not.toBeNull()
    expect(member!.id).toBe(res.body.memberId)
    expect(member!.enrolledVia).toBe('SURVEY_RESPONSE')
    expect(member!.email).toBe('newbie@example.com')
    expect(member!.consentGivenAt).not.toBeNull() // R8 server-stamped
  })

  // ---------------------------------------------------------------------------
  // Auto-enroll: EMBEDDED_FORM channel (URL-query-supplied identifier)
  // ---------------------------------------------------------------------------

  it('auto-enrolls a new member when memberId comes from URL query — enrolledVia = EMBEDDED_FORM', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond?member_id=${encodeURIComponent('embed@example.com')}`)
      .send({
        // Body intentionally has no memberId — URL query is the carrier.
        answers: { q1: 8 },
        score: 8,
      })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(true)
    expect(res.body.enrolledVia).toBe('EMBEDDED_FORM')

    const prisma = getTestPrisma()
    const member = await prisma.member.findUnique({
      where: { brandId_externalId: { brandId: brand.id, externalId: 'embed@example.com' } },
    })
    expect(member?.enrolledVia).toBe('EMBEDDED_FORM')
  })

  it('URL query takes priority when both URL query and body memberId are present', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond?member_id=url@example.com`)
      .send({
        memberId: 'body@example.com', // ignored
        answers: { q1: 7 },
        score: 7,
      })

    expect(res.status).toBe(201)
    expect(res.body.enrolledVia).toBe('EMBEDDED_FORM')

    const prisma = getTestPrisma()
    const fromUrl = await prisma.member.findUnique({
      where: { brandId_externalId: { brandId: brand.id, externalId: 'url@example.com' } },
    })
    const fromBody = await prisma.member.findUnique({
      where: { brandId_externalId: { brandId: brand.id, externalId: 'body@example.com' } },
    })
    expect(fromUrl).not.toBeNull()
    expect(fromBody).toBeNull()
  })

  it('returns 400 NO_IDENTIFIER when neither URL query nor body supplies an identifier', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ answers: { q1: 5 }, score: 5 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NO_IDENTIFIER')
  })

  // ---------------------------------------------------------------------------
  // R18 enrollment-signal capture
  // ---------------------------------------------------------------------------

  it('R18 — auto-enroll emits an enrollment loyalty event with enrollmentSignals payload', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberId: 'r18@example.com',
        answers: { q1: 7 },
        score: 7,
      })

    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    const enrollmentJob = loyaltyJobs.find(
      (j) => (j.data as { eventType?: string }).eventType === 'enrollment',
    )
    expect(enrollmentJob).toBeDefined()

    const payload = (enrollmentJob!.data as { payload: Record<string, unknown> }).payload
    expect(payload.autoEnrolled).toBe(true)
    expect(payload.enrolledVia).toBe('SURVEY_RESPONSE')
    expect(payload.surveyId).toBe(survey.id)
    const signals = payload.enrollmentSignals as { ipHash: string | null; ipCountryIso: string | null; capturedAt: string }
    expect(signals).toBeDefined()
    expect(typeof signals.capturedAt).toBe('string')
    // ipHash may be null if request.ip is empty in test transport; ipCountryIso is null because AZURE_MAPS_KEY is unset.
    expect(signals.ipCountryIso).toBeNull()
  })

  it('existing member — does NOT emit a fresh enrollment event on repeat survey responses', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'existing@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'existing@example.com', answers: { q1: 7 }, score: 7 })

    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    const enrollmentJob = loyaltyJobs.find(
      (j) => (j.data as { eventType?: string }).eventType === 'enrollment',
    )
    expect(enrollmentJob).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // R3 — responsePolicy enforcement
  // ---------------------------------------------------------------------------

  it('responsePolicy = ONCE — second submission returns 409 RESPONSE_ALREADY_EXISTS', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'once@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      responsePolicy: 'ONCE',
    })

    const first = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'once@example.com', answers: { q1: 8 }, score: 8 })
    expect(first.status).toBe(201)

    const second = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'once@example.com', answers: { q1: 10 }, score: 10 })

    expect(second.status).toBe(409)
    expect(second.body.error).toBe('RESPONSE_ALREADY_EXISTS')
    expect(second.body.priorResponseId).toBe(first.body.surveyResponseId)
  })

  it('responsePolicy = MULTIPLE — second submission inserts a second row', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'multi@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      responsePolicy: 'MULTIPLE',
    })

    const r1 = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'multi@example.com', answers: { q1: 7 }, score: 7 })
    const r2 = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'multi@example.com', answers: { q1: 9 }, score: 9 })

    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect(r2.body.surveyResponseId).not.toBe(r1.body.surveyResponseId)

    const prisma = getTestPrisma()
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: survey.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(responses.length).toBe(2)
    expect(responses[0]!.score).toBe(7)
    expect(responses[1]!.score).toBe(9)
  })

  it('responsePolicy = LATEST_OVERWRITES — second submission updates the existing row in place', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'overwrite@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      responsePolicy: 'LATEST_OVERWRITES',
    })

    const r1 = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'overwrite@example.com', answers: { q1: 5 }, score: 5 })
    const r2 = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'overwrite@example.com', answers: { q1: 10 }, score: 10 })

    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect(r2.body.overwrote).toBe(true)
    expect(r2.body.surveyResponseId).toBe(r1.body.surveyResponseId)

    const prisma = getTestPrisma()
    const responses = await prisma.surveyResponse.findMany({ where: { surveyId: survey.id } })
    expect(responses.length).toBe(1)
    expect(responses[0]!.score).toBe(10)
  })

  // ---------------------------------------------------------------------------
  // R5 — case-insensitive lookup of existing members
  // ---------------------------------------------------------------------------

  it('R5 — uppercase memberId resolves to existing lowercase externalId without creating a duplicate', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, email: 'mixed@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'MIXED@example.COM', answers: { q1: 7 }, score: 7 })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(false)
    expect(res.body.memberId).toBe(member.id)

    const prisma = getTestPrisma()
    const allMembers = await prisma.member.findMany({ where: { brandId: brand.id } })
    expect(allMembers.length).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // R16 — consent enforcement under EXPLICIT mode
  // ---------------------------------------------------------------------------

  it('EXPLICIT brand with consentTextDefault — body without consent:true returns 400 CONSENT_REQUIRED', async () => {
    const brand = await createBrand({
      consentMode: 'EXPLICIT',
      consentTextDefault: 'I agree to the privacy policy.',
    })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'noconsent@example.com', answers: { q1: 7 }, score: 7 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('CONSENT_REQUIRED')
  })

  it('EXPLICIT brand — consent:true accepts the submission', async () => {
    const brand = await createBrand({
      consentMode: 'EXPLICIT',
      consentTextDefault: 'I agree to the privacy policy.',
    })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberId: 'consenter@example.com',
        consent: true,
        answers: { q1: 7 },
        score: 7,
      })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // R17 — attest-and-suppress (empty-string consentTextOverride)
  // ---------------------------------------------------------------------------

  it('R17 — survey with empty-string consentTextOverride bypasses explicit-consent requirement', async () => {
    const brand = await createBrand({
      consentMode: 'EXPLICIT',
      consentTextDefault: 'Brand-default consent text',
    })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      consentTextOverride: '',
      consentSuppressedAttestedBy: 'admin@brand.com',
      consentSuppressedAttestedAt: new Date(),
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberId: 'silentconsent@example.com',
        answers: { q1: 8 },
        score: 8,
      })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // R4 — identifier-shape rejection on PHONE brand
  // ---------------------------------------------------------------------------

  it('PHONE brand — non-E.164 memberId returns 400 IDENTIFIER_SHAPE_INVALID', async () => {
    const brand = await createBrand({
      consentMode: 'IMPLIED_ON_SUBMIT',
      memberIdentifierKind: 'PHONE',
    })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'not-a-phone', answers: { q1: 7 }, score: 7 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('IDENTIFIER_SHAPE_INVALID')
    expect(res.body.expectedKind).toBe('PHONE')
  })

  it('PHONE brand — E.164 memberId auto-enrolls', async () => {
    const brand = await createBrand({
      consentMode: 'IMPLIED_ON_SUBMIT',
      memberIdentifierKind: 'PHONE',
    })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: '+14155552671', answers: { q1: 7 }, score: 7 })

    expect(res.status).toBe(201)
    expect(res.body.autoEnrolled).toBe(true)

    const prisma = getTestPrisma()
    const member = await prisma.member.findUnique({
      where: { brandId_externalId: { brandId: brand.id, externalId: '+14155552671' } },
    })
    expect(member).not.toBeNull()
    // PHONE brands don't auto-derive an email PII sidecar from memberId.
    expect(member!.email).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Edge: incentive points + sentiment + 404 for missing survey
  // ---------------------------------------------------------------------------

  it('includes incentivePoints and enqueues the incentive event', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'incentive@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      incentivePoints: 200,
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'incentive@example.com', answers: { q1: 7 }, score: 7 })

    expect(res.status).toBe(201)
    expect(res.body.incentivePoints).toBe(200)

    const loyaltyJobs = InMemoryQueue.getJobs('loyalty-events')
    const incentiveJob = loyaltyJobs.find(
      (j) => (j.data as { payload?: { incentive?: boolean } }).payload?.incentive === true,
    )
    expect(incentiveJob).toBeDefined()
  })

  it('enqueues sentiment analysis when the response contains open-ended text', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'feedback@example.com' })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      type: 'NPS',
    })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({
        memberId: 'feedback@example.com',
        answers: { q1: 6, q2: 'The shipping was incredibly slow' },
        score: 6,
      })

    expect(res.status).toBe(201)

    const sentimentJobs = InMemoryQueue.getJobs('sentiment-analysis')
    const job = sentimentJobs.find(
      (j) => (j.data as { surveyResponseId?: string }).surveyResponseId === res.body.surveyResponseId,
    )
    expect(job).toBeDefined()
  })

  it('returns 404 when submitting to a non-existent survey', async () => {
    const res = await unauthenticatedRequest()
      .post('/v1/public/surveys/fake-survey-id/respond')
      .send({ memberId: 'someone@example.com', answers: { q1: 5 }, score: 5 })

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
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, email: 'respondent@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

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
      .send({ memberId: 'respondent@example.com', answers: { q1: 3 }, score: 3 })

    expect(res.status).toBe(201)
    expect(res.body.memberId).toBe(member.id)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const job = triggerJobs.find(
      (j) => (j.data as { campaignId?: string }).campaignId === campaign.id,
    )
    expect(job).toBeDefined()
    expect((job!.data as { surveyResponseId?: string }).surveyResponseId).toBe(res.body.surveyResponseId)
  })

  it('non-matching rule does NOT enqueue a campaign trigger', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'promoter@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

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
      .send({ memberId: 'promoter@example.com', answers: { q1: 9 }, score: 9 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matchedJob = triggerJobs.find(
      (j) => (j.data as { campaignId?: string }).campaignId === campaign.id,
    )
    expect(matchedJob).toBeUndefined()
  })

  it('boundary score (scoreMax exact match) IS matched', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
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

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'boundary@example.com', answers: { q1: 6 }, score: 6 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matched = triggerJobs.find((j) => (j.data as { campaignId?: string }).campaignId === campaign.id)
    expect(matched).toBeDefined()
  })

  it('no rules seeded → no campaign trigger enqueued', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'norules@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })

    const res = await unauthenticatedRequest()
      .post(`/v1/public/surveys/${survey.id}/respond`)
      .send({ memberId: 'norules@example.com', answers: { q1: 5 }, score: 5 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    expect(triggerJobs.length).toBe(0)
  })

  it('INACTIVE campaign rule is skipped even when score matches', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    await createConsentedMember({ brandId: brand.id, email: 'inactive@example.com' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE', type: 'NPS' })
    const prisma = getTestPrisma()

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
      .send({ memberId: 'inactive@example.com', answers: { q1: 4 }, score: 4 })

    expect(res.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const triggerJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matched = triggerJobs.find((j) => (j.data as { campaignId?: string }).campaignId === campaign.id)
    expect(matched).toBeUndefined()
  })
})
