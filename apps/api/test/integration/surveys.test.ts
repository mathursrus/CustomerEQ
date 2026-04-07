/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  authenticatedRequest,
  InMemoryQueue,
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
