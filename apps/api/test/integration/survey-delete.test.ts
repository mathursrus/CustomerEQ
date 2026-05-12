/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  authenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

/**
 * Issue #332 (#241 Slice 2 follow-up) — DELETE /v1/surveys/:id.
 *
 * Uniform soft-delete via `Survey.deletedAt`. DRAFT and STOPPED soft-delete;
 * ACTIVE and PAUSED return 409 INVALID_STATE_FOR_DELETE (must Stop first).
 * Backs both spec §1 ⋯ menu items: "Discard draft" and "Delete".
 */

describe('DELETE /v1/surveys/:id (Issue #332)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('soft-deletes a DRAFT survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    const res = await request.delete(`/v1/surveys/${survey.id}`).send()

    expect(res.status).toBe(204)

    const row = await getTestPrisma().survey.findUnique({ where: { id: survey.id } })
    expect(row?.deletedAt).toBeTruthy()
  })

  it('soft-deletes a STOPPED survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'STOPPED' })
    const request = authenticatedRequest(brand.id)

    const res = await request.delete(`/v1/surveys/${survey.id}`).send()

    expect(res.status).toBe(204)

    const row = await getTestPrisma().survey.findUnique({ where: { id: survey.id } })
    expect(row?.deletedAt).toBeTruthy()
  })

  it('returns 409 INVALID_STATE_FOR_DELETE for ACTIVE survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request.delete(`/v1/surveys/${survey.id}`).send()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('INVALID_STATE_FOR_DELETE')
    expect(res.body.currentState).toBe('ACTIVE')

    const row = await getTestPrisma().survey.findUnique({ where: { id: survey.id } })
    expect(row?.deletedAt).toBeNull()
  })

  it('returns 409 INVALID_STATE_FOR_DELETE for PAUSED survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'PAUSED' })
    const request = authenticatedRequest(brand.id)

    const res = await request.delete(`/v1/surveys/${survey.id}`).send()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('INVALID_STATE_FOR_DELETE')
  })

  it('excludes soft-deleted surveys from GET /v1/surveys list', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const keep = await createSurvey({ brandId: brand.id, programId: program.id, name: 'keep' })
    // DRAFT so DELETE succeeds.
    const drop = await createSurvey({ brandId: brand.id, programId: program.id, name: 'drop', status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    await request.delete(`/v1/surveys/${drop.id}`).send()
    const res = await request.get('/v1/surveys')

    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((s) => s.id)
    expect(ids).toContain(keep.id)
    expect(ids).not.toContain(drop.id)
  })

  it('returns 404 from GET /v1/surveys/:id for a soft-deleted survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    await request.delete(`/v1/surveys/${survey.id}`).send()
    const res = await request.get(`/v1/surveys/${survey.id}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when deleting another brand’s survey (no cross-tenant leak)', async () => {
    const brandA = await createBrand()
    const programA = await createProgram({ brandId: brandA.id })
    const surveyA = await createSurvey({ brandId: brandA.id, programId: programA.id })
    const brandB = await createBrand()
    const requestAsBrandB = authenticatedRequest(brandB.id)

    const res = await requestAsBrandB.delete(`/v1/surveys/${surveyA.id}`).send()

    expect(res.status).toBe(404)

    const row = await getTestPrisma().survey.findUnique({ where: { id: surveyA.id } })
    expect(row?.deletedAt).toBeNull()
  })

  it('returns 404 on a second DELETE of the same survey (already soft-deleted)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    const first = await request.delete(`/v1/surveys/${survey.id}`).send()
    expect(first.status).toBe(204)

    const second = await request.delete(`/v1/surveys/${survey.id}`).send()
    expect(second.status).toBe(404)
  })
})
