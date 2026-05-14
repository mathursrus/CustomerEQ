/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createKBSource,
  authenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('KBSource API — integration', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('POST /v1/kb/sources creates a manual source', async () => {
    const brand = await createBrand({ name: 'BrandS' })
    const req = authenticatedRequest(brand.id)
    const res = await req.post('/v1/kb/sources').send({
      kind: 'MANUAL',
      title: 'Internal SOPs',
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ kind: 'MANUAL', title: 'Internal SOPs', status: 'ACTIVE' })
    expect(res.body.brandId).toBe(brand.id)
  })

  it('POST /v1/kb/sources rejects URL kind without url', async () => {
    const brand = await createBrand({ name: 'BrandS2' })
    const req = authenticatedRequest(brand.id)
    const res = await req.post('/v1/kb/sources').send({ kind: 'URL', title: 'docs' })
    expect(res.status).toBe(422)
  })

  it('GET /v1/kb/sources lists only the caller brand sources', async () => {
    const brandA = await createBrand({ name: 'A' })
    const brandB = await createBrand({ name: 'B' })
    await createKBSource({ brandId: brandA.id, kind: 'MANUAL', title: 'A-only' })
    await createKBSource({ brandId: brandB.id, kind: 'MANUAL', title: 'B-only' })

    const req = authenticatedRequest(brandA.id)
    const res = await req.get('/v1/kb/sources')
    expect(res.status).toBe(200)
    expect(res.body.sources).toHaveLength(1)
    expect(res.body.sources[0].title).toBe('A-only')
  })

  it('PATCH /v1/kb/sources/:id updates title', async () => {
    const brand = await createBrand({ name: 'BrandP' })
    const source = await createKBSource({ brandId: brand.id, kind: 'MANUAL', title: 'old' })
    const req = authenticatedRequest(brand.id)
    const res = await req.patch(`/v1/kb/sources/${source.id}`).send({ title: 'new' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('new')
  })

  it('PATCH /v1/kb/sources/:id rejects cross-brand', async () => {
    const brandA = await createBrand({ name: 'CA' })
    const brandB = await createBrand({ name: 'CB' })
    const sourceB = await createKBSource({ brandId: brandB.id, kind: 'MANUAL', title: 'b' })
    const req = authenticatedRequest(brandA.id)
    const res = await req.patch(`/v1/kb/sources/${sourceB.id}`).send({ title: 'hijack' })
    expect([403, 404]).toContain(res.status)
  })

  it('DELETE /v1/kb/sources/:id soft-deletes via status=DISABLED', async () => {
    const brand = await createBrand({ name: 'BrandD' })
    const source = await createKBSource({ brandId: brand.id, kind: 'MANUAL', title: 'gone' })
    const req = authenticatedRequest(brand.id)
    const res = await req.delete(`/v1/kb/sources/${source.id}`)
    expect([200, 204]).toContain(res.status)
    const after = await getTestPrisma().kBSource.findUnique({ where: { id: source.id } })
    // soft-delete via status=DISABLED is acceptable; hard delete also OK if that's the convention
    if (after) expect(after.status).toBe('DISABLED')
  })

  it('POST /v1/kb/sources/:id/crawl enqueues a crawl job (URL sources only)', async () => {
    const brand = await createBrand({ name: 'BrandC' })
    const source = await createKBSource({ brandId: brand.id, kind: 'URL', url: 'https://docs.example.com', title: 'docs' })
    const req = authenticatedRequest(brand.id)
    const res = await req.post(`/v1/kb/sources/${source.id}/crawl`)
    expect(res.status).toBe(202)
    expect(res.body).toMatchObject({ enqueued: true })
  })

  it('POST .../crawl rejects MANUAL sources', async () => {
    const brand = await createBrand({ name: 'BrandM' })
    const source = await createKBSource({ brandId: brand.id, kind: 'MANUAL', title: 'm' })
    const req = authenticatedRequest(brand.id)
    const res = await req.post(`/v1/kb/sources/${source.id}/crawl`)
    expect(res.status).toBe(400)
  })
})
