/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createSupportWidgetConfig,
  authenticatedRequest,
  unauthenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('SupportWidgetConfig API — integration', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('GET /v1/public/support/widget-config returns defaults when no row exists', async () => {
    const brand = await createBrand({ name: 'NoConfigBrand' })
    const req = unauthenticatedRequest()
    const res = await req.get(`/v1/public/support/widget-config?brandId=${brand.id}`)
    expect(res.status).toBe(200)
    expect(res.body.brandId).toBe(brand.id)
    expect(res.body.brandName).toBe('NoConfigBrand')
    expect(res.body.widget.greeting).toBeTruthy()
    expect(res.body.theme.primaryColor).toBeTruthy()
  })

  it('GET /v1/public/support/widget-config returns the brand row when set', async () => {
    const brand = await createBrand({ name: 'ConfigBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, greeting: 'Custom greeting' })
    const req = unauthenticatedRequest()
    const res = await req.get(`/v1/public/support/widget-config?brandId=${brand.id}`)
    expect(res.status).toBe(200)
    expect(res.body.widget.greeting).toBe('Custom greeting')
  })

  it('GET .../widget-config rejects missing brandId', async () => {
    const req = unauthenticatedRequest()
    const res = await req.get('/v1/public/support/widget-config')
    expect(res.status).toBe(400)
  })

  it('GET .../widget-config 404s for nonexistent brand', async () => {
    const req = unauthenticatedRequest()
    const res = await req.get('/v1/public/support/widget-config?brandId=does_not_exist')
    expect(res.status).toBe(404)
  })

  it('PUT /v1/support/widget-config (authed) upserts the brand config', async () => {
    const brand = await createBrand({ name: 'PutBrand' })
    const req = authenticatedRequest(brand.id)
    const res = await req.put('/v1/support/widget-config').send({ greeting: 'New greeting', anonAllowed: false })
    expect(res.status).toBe(200)
    expect(res.body.greeting).toBe('New greeting')
    expect(res.body.anonAllowed).toBe(false)
  })

  it('PUT .../widget-config validates field constraints (csatTimeoutSeconds bounds)', async () => {
    const brand = await createBrand({ name: 'PutBoundsBrand' })
    const req = authenticatedRequest(brand.id)
    const res = await req.put('/v1/support/widget-config').send({ csatTimeoutSeconds: 999999 })
    expect(res.status).toBe(422)
  })

  it('PUT .../widget-config requires auth (no JWT → 401)', async () => {
    const req = unauthenticatedRequest()
    const res = await req.put('/v1/support/widget-config').send({ greeting: 'x' })
    expect([401, 403]).toContain(res.status)
  })
})
