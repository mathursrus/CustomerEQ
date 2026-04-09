/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  createSurveyResponse,
  createConsentedMember,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Surveys API — /v1/surveys', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  const basePayload = () => ({
    name: 'Post-Purchase NPS',
    type: 'NPS',
    questions: [
      { id: 'q1', text: 'How likely are you to recommend us?', type: 'rating', required: true },
    ],
  })

  // -------------------------------------------------------------------------
  // POST /v1/surveys — backwards compatibility (no trigger fields)
  // -------------------------------------------------------------------------

  describe('POST /v1/surveys — without trigger fields', () => {
    it('creates a survey successfully with no trigger fields', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeTruthy()
      expect(res.body.triggerCategory).toBeNull()
      expect(res.body.triggerKey).toBeNull()
      expect(res.body.surveyTypeOverride).toBeNull()
    })

    it('rejects missing programId with 422', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send(basePayload())

      expect(res.status).toBe(422)
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/surveys — with trigger fields (Issue #79)
  // -------------------------------------------------------------------------

  describe('POST /v1/surveys — with trigger fields', () => {
    it('persists triggerCategory and triggerKey on the survey record', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'loyalty',
        triggerKey: 'tier_upgrade',
      })

      expect(res.status).toBe(201)
      expect(res.body.triggerCategory).toBe('loyalty')
      expect(res.body.triggerKey).toBe('tier_upgrade')
      expect(res.body.surveyTypeOverride).toBeNull()
    })

    it('persists surveyTypeOverride when manager deviated from recommendation', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'cx_risk',
        triggerKey: 'after_support',
        surveyTypeOverride: 'NPS', // CES was recommended, manager chose NPS
      })

      expect(res.status).toBe(201)
      expect(res.body.triggerCategory).toBe('cx_risk')
      expect(res.body.triggerKey).toBe('after_support')
      expect(res.body.surveyTypeOverride).toBe('NPS')
    })

    it('accepts scheduled triggerCategory', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'scheduled',
        triggerKey: 'quarterly_pulse',
      })

      expect(res.status).toBe(201)
      expect(res.body.triggerCategory).toBe('scheduled')
    })

    it('rejects invalid triggerCategory with 422', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'invalid_category',
      })

      expect(res.status).toBe(422)
    })

    it('rejects invalid surveyTypeOverride with 422', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'loyalty',
        triggerKey: 'tier_upgrade',
        surveyTypeOverride: 'INVALID_TYPE',
      })

      expect(res.status).toBe(422)
    })

    it('survey list returns triggerCategory and triggerKey fields', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      await request.post('/v1/surveys').send({
        ...basePayload(),
        programId: program.id,
        triggerCategory: 'loyalty',
        triggerKey: 'tier_upgrade',
      })

      const listRes = await request.get('/v1/surveys')
      expect(listRes.status).toBe(200)
      const survey = listRes.body.data[0]
      expect(survey.triggerCategory).toBe('loyalty')
      expect(survey.triggerKey).toBe('tier_upgrade')
    })
  })
})

// =============================================================================
// Issue #80: POST /v1/surveys/:id/launch
// =============================================================================

describe('Survey Launch API — POST /v1/surveys/:id/launch', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  const rulePayload = () => ({
    rules: [
      { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 }, ruleLabel: 'Detractors' },
      { scoreMin: 9, scoreMax: 10, actionType: 'award_points', actionConfig: { points: 50 }, ruleLabel: 'Promoters' },
    ],
  })

  it('activates survey and creates campaigns + survey rules', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const prisma = getTestPrisma()

    const res = await authenticatedRequest(brand.id)
      .post(`/v1/surveys/${survey.id}/launch`)
      .send(rulePayload())

    expect(res.status).toBe(200)
    expect(res.body.campaignsCreated).toBe(2)

    // Verify survey status changed to ACTIVE
    const updatedSurvey = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } })
    expect(updatedSurvey.status).toBe('ACTIVE')

    // Verify survey rules created
    const rules = await prisma.surveyRule.findMany({ where: { surveyId: survey.id } })
    expect(rules).toHaveLength(2)
    expect(rules.map((r) => r.ruleLabel).sort()).toEqual(['Detractors', 'Promoters'])

    // Verify campaigns created
    const campaigns = await prisma.campaign.findMany({ where: { surveyId: survey.id } })
    expect(campaigns).toHaveLength(2)
    expect(campaigns.every((c) => c.status === 'ACTIVE')).toBe(true)
    expect(campaigns.every((c) => c.triggerType === 'cx.survey_response')).toBe(true)
  })

  it('is idempotent: second call on ACTIVE survey returns 200 without re-creating campaigns', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const prisma = getTestPrisma()

    await authenticatedRequest(brand.id).post(`/v1/surveys/${survey.id}/launch`).send(rulePayload())
    const secondRes = await authenticatedRequest(brand.id).post(`/v1/surveys/${survey.id}/launch`).send(rulePayload())

    expect(secondRes.status).toBe(200)
    expect(secondRes.body.idempotent).toBe(true)

    // Still only 2 rules (not doubled)
    const rules = await prisma.surveyRule.findMany({ where: { surveyId: survey.id } })
    expect(rules).toHaveLength(2)
  })

  it('rejects overlapping rules with 422 before touching DB', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const prisma = getTestPrisma()

    const res = await authenticatedRequest(brand.id)
      .post(`/v1/surveys/${survey.id}/launch`)
      .send({
        rules: [
          { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 } },
          { scoreMin: 5, scoreMax: 8, actionType: 'award_points', actionConfig: { points: 50 } },
        ],
      })

    expect(res.status).toBe(422)

    // Survey should still be DRAFT
    const surveyAfter = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } })
    expect(surveyAfter.status).toBe('DRAFT')
  })

  it('launches with empty rules (no campaigns created)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const prisma = getTestPrisma()

    const res = await authenticatedRequest(brand.id)
      .post(`/v1/surveys/${survey.id}/launch`)
      .send({ rules: [] })

    expect(res.status).toBe(200)
    expect(res.body.campaignsCreated).toBe(0)

    const updatedSurvey = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } })
    expect(updatedSurvey.status).toBe('ACTIVE')
  })

  it('returns 404 for survey from another brand', async () => {
    const brand1 = await createBrand()
    const brand2 = await createBrand()
    const program = await createProgram({ brandId: brand1.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand1.id, programId: program.id, status: 'DRAFT' })

    const res = await authenticatedRequest(brand2.id)
      .post(`/v1/surveys/${survey.id}/launch`)
      .send({ rules: [] })

    expect(res.status).toBe(404)
  })
})

// =============================================================================
// Issue #80: GET /v1/surveys/:id/loop-monitor
// =============================================================================

describe('Loop Monitor API — GET /v1/surveys/:id/loop-monitor', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('returns placeholder for DRAFT survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })

    const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/loop-monitor`)

    expect(res.status).toBe(200)
    expect(res.body.placeholder).toBe(true)
  })

  it('returns 404 for survey from another brand', async () => {
    const brand1 = await createBrand()
    const brand2 = await createBrand()
    const program = await createProgram({ brandId: brand1.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand1.id, programId: program.id, status: 'ACTIVE' })

    const res = await authenticatedRequest(brand2.id).get(`/v1/surveys/${survey.id}/loop-monitor`)
    expect(res.status).toBe(404)
  })

  it('returns pipeline counts for active survey with seeded responses', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })

    await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, score: 3 })

    const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/loop-monitor`)

    expect(res.status).toBe(200)
    expect(res.body.placeholder).toBeFalsy()
    expect(res.body.pipeline.responsesReceived).toBe(1)
    expect(res.body.pipeline.rulesMatched).toBe(0) // no survey rules seeded
    expect(res.body.pipeline.campaignsTriggered).toBe(0)
  })

  it('returns 48h warning when first response > 48h ago with 0 campaigns triggered', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const prisma = getTestPrisma()

    // Create a response with a completedAt timestamp 49h ago
    const oldTimestamp = new Date(Date.now() - 49 * 60 * 60 * 1000)
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        memberId: member.id,
        brandId: brand.id,
        answers: { q1: 3 },
        score: 3,
        completedAt: oldTimestamp,
        createdAt: oldTimestamp,
        channel: 'link',
      },
    })

    const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/loop-monitor`)

    expect(res.status).toBe(200)
    expect(res.body.warning).not.toBeNull()
    expect(res.body.warning.type).toBe('no_campaigns_triggered_48h')
  })

  it('does not return warning when campaigns have been triggered', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id })
    const prisma = getTestPrisma()

    // Old response
    const oldTimestamp = new Date(Date.now() - 49 * 60 * 60 * 1000)
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        memberId: member.id,
        brandId: brand.id,
        answers: { q1: 3 },
        score: 3,
        completedAt: oldTimestamp,
        createdAt: oldTimestamp,
        channel: 'link',
      },
    })

    // Seed a launched campaign linked to this survey
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'Test Campaign',
        triggerType: 'cx.survey_response',
        triggerCondition: { surveyId: survey.id, scoreMin: 0, scoreMax: 6 },
        actionType: 'award_points',
        actionConfig: { points: 100 },
        status: 'ACTIVE',
        startDate: new Date(),
        surveyId: survey.id,
      },
    })

    // Seed a campaign event with surveyResponseId
    await prisma.campaignEvent.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        memberId: member.id,
        status: 'executed',
        surveyResponseId: response.id,
      },
    })

    const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/loop-monitor`)

    expect(res.status).toBe(200)
    expect(res.body.warning).toBeNull()
    expect(res.body.pipeline.campaignsTriggered).toBe(1)
  })
})
