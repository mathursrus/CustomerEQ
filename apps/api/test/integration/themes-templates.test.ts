/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Themes & Templates API', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  const themePayload = {
    name: 'Corporate Blue',
    primaryColor: '#1a56db',
    buttonColor: '#1a56db',
  }

  const templatePayload = {
    name: 'Standard NPS',
    question: { id: 'q1', text: 'How likely to recommend?', type: 'rating' },
    tags: ['nps'],
  }

  // ---------------------------------------------------------------------------
  // Themes CRUD
  // ---------------------------------------------------------------------------

  // 1. Create theme
  // ---------------------------------------------------------------------------

  it('creates a theme via POST /v1/themes', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/themes').send(themePayload)

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('Corporate Blue')
    expect(res.body.primaryColor).toBe('#1a56db')
    expect(res.body.buttonColor).toBe('#1a56db')
    expect(res.body.brandId).toBe(brand.id)
    // Color defaults should be applied
    expect(res.body.backgroundColor).toBeDefined()
    expect(res.body.textColor).toBeDefined()
  })

  // 2. List themes
  // ---------------------------------------------------------------------------

  it('lists themes via GET /v1/themes', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    await request.post('/v1/themes').send(themePayload)
    await request.post('/v1/themes').send({ ...themePayload, name: 'Corporate Red', primaryColor: '#dc2626' })

    const res = await request.get('/v1/themes')

    expect(res.status).toBe(200)
    expect(res.body.themes).toHaveLength(2)
  })

  // 3. Get theme detail
  // ---------------------------------------------------------------------------

  it('gets theme detail via GET /v1/themes/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/themes').send(themePayload)
    const themeId = createRes.body.id

    const res = await request.get(`/v1/themes/${themeId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(themeId)
    expect(res.body.name).toBe('Corporate Blue')
    expect(res.body._count).toBeDefined()
  })

  // 4. Update theme
  // ---------------------------------------------------------------------------

  it('updates a theme via PATCH /v1/themes/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/themes').send(themePayload)
    const themeId = createRes.body.id

    const res = await request.patch(`/v1/themes/${themeId}`).send({ primaryColor: '#dc2626' })

    expect(res.status).toBe(200)
    expect(res.body.primaryColor).toBe('#dc2626')
    // Other fields remain unchanged
    expect(res.body.name).toBe('Corporate Blue')
    expect(res.body.buttonColor).toBe('#1a56db')
  })

  // 5. Set theme as default
  // ---------------------------------------------------------------------------

  it('sets theme as default via POST /v1/themes/:id/default (Issue #291 — writes Brand.defaultThemeId)', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    // Issue #291 — `isDefault` is no longer accepted on create; it's a server-derived
    // value computed from `brand.defaultThemeId === theme.id`. The dedicated
    // `POST /v1/themes/:id/default` endpoint writes `Brand.defaultThemeId` directly.
    const theme1Res = await request.post('/v1/themes').send(themePayload)
    const theme2Res = await request.post('/v1/themes').send({ ...themePayload, name: 'Alt Theme' })
    const theme1Id = theme1Res.body.id
    const theme2Id = theme2Res.body.id

    // Both newly-created themes start as non-default.
    expect(theme1Res.body.isDefault).toBe(false)
    expect(theme2Res.body.isDefault).toBe(false)

    // Set theme1 as default → theme1.isDefault should derive to true.
    await request.post(`/v1/themes/${theme1Id}/default`)
    let theme1Detail = await request.get(`/v1/themes/${theme1Id}`)
    expect(theme1Detail.body.isDefault).toBe(true)

    // Move default to theme2.
    const res = await request.post(`/v1/themes/${theme2Id}/default`)
    expect(res.status).toBe(200)
    expect(res.body.isDefault).toBe(true)

    // theme1 should no longer be default (derived from brand.defaultThemeId).
    theme1Detail = await request.get(`/v1/themes/${theme1Id}`)
    expect(theme1Detail.body.isDefault).toBe(false)
  })

  // 6. Delete unused theme
  // ---------------------------------------------------------------------------

  it('deletes an unused theme via DELETE /v1/themes/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/themes').send(themePayload)
    const themeId = createRes.body.id

    const res = await request.delete(`/v1/themes/${themeId}`).set('Content-Type', 'text/plain')

    expect(res.status).toBe(204)

    // Verify it's gone
    const getRes = await request.get(`/v1/themes/${themeId}`)
    expect(getRes.status).toBe(404)
  })

  // 7. Reject delete of theme in use
  // ---------------------------------------------------------------------------

  it('rejects delete of theme in use by a survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    // Create theme
    const themeRes = await request.post('/v1/themes').send(themePayload)
    const themeId = themeRes.body.id

    // Create survey using the theme
    await request.post('/v1/surveys').send({
      name: 'Survey With Theme',
      programId: program.id,
      type: 'NPS',
      themeId,
      questions: [
        { id: 'q1', text: 'How likely are you to recommend us?', type: 'rating', required: true },
      ],
    })

    // Attempt to delete the theme — should fail with 409
    const deleteRes = await request.delete(`/v1/themes/${themeId}`).set('Content-Type', 'text/plain')

    expect(deleteRes.status).toBe(409)
    expect(deleteRes.body.error).toBe('Theme is in use')
  })

  // ---------------------------------------------------------------------------
  // Question Templates CRUD
  // ---------------------------------------------------------------------------

  // 8. Create template
  // ---------------------------------------------------------------------------

  it('creates a template via POST /v1/question-templates', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/question-templates').send(templatePayload)

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('Standard NPS')
    expect(res.body.question.id).toBe('q1')
    expect(res.body.question.text).toBe('How likely to recommend?')
    expect(res.body.question.type).toBe('rating')
    expect(res.body.tags).toEqual(['nps'])
    expect(res.body.brandId).toBe(brand.id)
  })

  // 9. List templates
  // ---------------------------------------------------------------------------

  it('lists templates via GET /v1/question-templates', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    await request.post('/v1/question-templates').send(templatePayload)
    await request.post('/v1/question-templates').send({
      ...templatePayload,
      name: 'CSAT Template',
      tags: ['csat'],
    })

    const res = await request.get('/v1/question-templates')

    expect(res.status).toBe(200)
    expect(res.body.templates).toHaveLength(2)
  })

  // 10. Delete template
  // ---------------------------------------------------------------------------

  it('deletes a template via DELETE /v1/question-templates/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/question-templates').send(templatePayload)
    const templateId = createRes.body.id

    const res = await request.delete(`/v1/question-templates/${templateId}`).set('Content-Type', 'text/plain')

    expect(res.status).toBe(204)

    // Verify it's gone — listing should be empty
    const listRes = await request.get('/v1/question-templates')
    expect(listRes.body.templates).toHaveLength(0)
  })
})
