/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  authenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('CX Playbooks API — /v1/cx-playbooks', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  const baseRules = () => [
    { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 }, ruleLabel: 'Detractors' },
    { scoreMin: 9, scoreMax: 10, actionType: 'award_points', actionConfig: { points: 50 }, ruleLabel: 'Promoters' },
  ]

  // ---------------------------------------------------------------------------
  // POST /v1/cx-playbooks
  // ---------------------------------------------------------------------------

  describe('POST /v1/cx-playbooks', () => {
    it('creates a playbook successfully', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/cx-playbooks').send({
        name: 'Detractor Rescue',
        surveyType: 'NPS',
        rules: baseRules(),
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeTruthy()
      expect(res.body.name).toBe('Detractor Rescue')
      expect(res.body.brandId).toBe(brand.id)
      expect(res.body.deletedAt).toBeNull()
    })

    it('rejects duplicate name within same brand with 422', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      await request.post('/v1/cx-playbooks').send({
        name: 'My Playbook',
        surveyType: 'NPS',
        rules: baseRules(),
      })

      const res = await request.post('/v1/cx-playbooks').send({
        name: 'My Playbook',
        surveyType: 'NPS',
        rules: baseRules(),
      })

      expect(res.status).toBe(422)
    })

    it('allows same name in different brands', async () => {
      const brand1 = await createBrand()
      const brand2 = await createBrand()

      const res1 = await authenticatedRequest(brand1.id).post('/v1/cx-playbooks').send({
        name: 'Shared Name',
        surveyType: 'NPS',
        rules: baseRules(),
      })
      const res2 = await authenticatedRequest(brand2.id).post('/v1/cx-playbooks').send({
        name: 'Shared Name',
        surveyType: 'NPS',
        rules: baseRules(),
      })

      expect(res1.status).toBe(201)
      expect(res2.status).toBe(201)
    })

    it('rejects overlapping rule ranges with 422', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.post('/v1/cx-playbooks').send({
        name: 'Overlapping',
        surveyType: 'NPS',
        rules: [
          { scoreMin: 0, scoreMax: 6, actionType: 'award_points', actionConfig: { points: 100 } },
          { scoreMin: 5, scoreMax: 8, actionType: 'award_points', actionConfig: { points: 50 } },
        ],
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toContain('overlap')
    })

    it('rejects invalid surveyType', async () => {
      const brand = await createBrand()
      const res = await authenticatedRequest(brand.id).post('/v1/cx-playbooks').send({
        name: 'Invalid',
        surveyType: 'STELLAR',
        rules: baseRules(),
      })
      expect(res.status).toBe(422)
    })

    it('rejects empty rules array', async () => {
      const brand = await createBrand()
      const res = await authenticatedRequest(brand.id).post('/v1/cx-playbooks').send({
        name: 'Empty',
        surveyType: 'NPS',
        rules: [],
      })
      expect(res.status).toBe(422)
    })
  })

  // ---------------------------------------------------------------------------
  // GET /v1/cx-playbooks
  // ---------------------------------------------------------------------------

  describe('GET /v1/cx-playbooks', () => {
    it('returns playbooks for the brand', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      await request.post('/v1/cx-playbooks').send({ name: 'P1', surveyType: 'NPS', rules: baseRules() })
      await request.post('/v1/cx-playbooks').send({ name: 'P2', surveyType: 'CSAT', rules: [{ scoreMin: 1, scoreMax: 3, actionType: 'award_points', actionConfig: { points: 50 } }] })

      const res = await request.get('/v1/cx-playbooks')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
    })

    it('filters by surveyType', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      await request.post('/v1/cx-playbooks').send({ name: 'NPS Playbook', surveyType: 'NPS', rules: baseRules() })
      await request.post('/v1/cx-playbooks').send({ name: 'CSAT Playbook', surveyType: 'CSAT', rules: [{ scoreMin: 1, scoreMax: 3, actionType: 'award_points', actionConfig: { points: 50 } }] })

      const res = await request.get('/v1/cx-playbooks?surveyType=CSAT')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('CSAT Playbook')
    })

    it('does not return playbooks from other brands (cross-tenant isolation)', async () => {
      const brand1 = await createBrand()
      const brand2 = await createBrand()

      await authenticatedRequest(brand1.id).post('/v1/cx-playbooks').send({ name: 'Brand1 Playbook', surveyType: 'NPS', rules: baseRules() })

      const res = await authenticatedRequest(brand2.id).get('/v1/cx-playbooks')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0)
    })

    it('excludes soft-deleted playbooks', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const createRes = await request.post('/v1/cx-playbooks').send({ name: 'To Delete', surveyType: 'NPS', rules: baseRules() })
      await request.delete(`/v1/cx-playbooks/${createRes.body.id}`)

      const listRes = await request.get('/v1/cx-playbooks')
      expect(listRes.body.data).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // PUT /v1/cx-playbooks/:id
  // ---------------------------------------------------------------------------

  describe('PUT /v1/cx-playbooks/:id', () => {
    it('updates playbook rules', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const createRes = await request.post('/v1/cx-playbooks').send({ name: 'Original', surveyType: 'NPS', rules: baseRules() })
      const id = createRes.body.id

      const updatedRules = [{ scoreMin: 0, scoreMax: 5, actionType: 'award_points', actionConfig: { points: 200 } }]
      const updateRes = await request.put(`/v1/cx-playbooks/${id}`).send({ rules: updatedRules })

      expect(updateRes.status).toBe(200)
      expect((updateRes.body.rules as unknown[]).length).toBe(1)
    })

    it('returns 404 for playbook from another brand', async () => {
      const brand1 = await createBrand()
      const brand2 = await createBrand()

      const createRes = await authenticatedRequest(brand1.id).post('/v1/cx-playbooks').send({ name: 'B1 Playbook', surveyType: 'NPS', rules: baseRules() })

      const res = await authenticatedRequest(brand2.id).put(`/v1/cx-playbooks/${createRes.body.id}`).send({ name: 'Hijack' })
      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  // DELETE /v1/cx-playbooks/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /v1/cx-playbooks/:id', () => {
    it('soft-deletes playbook, returns 204', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const createRes = await request.post('/v1/cx-playbooks').send({ name: 'To Delete', surveyType: 'NPS', rules: baseRules() })
      const deleteRes = await request.delete(`/v1/cx-playbooks/${createRes.body.id}`)

      expect(deleteRes.status).toBe(204)

      // Not returned in subsequent GET
      const listRes = await request.get('/v1/cx-playbooks')
      expect(listRes.body.data).toHaveLength(0)
    })

    it('returns 404 for already-deleted playbook', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const createRes = await request.post('/v1/cx-playbooks').send({ name: 'Gone', surveyType: 'NPS', rules: baseRules() })
      await request.delete(`/v1/cx-playbooks/${createRes.body.id}`)
      const secondDelete = await request.delete(`/v1/cx-playbooks/${createRes.body.id}`)

      expect(secondDelete.status).toBe(404)
    })
  })
})
