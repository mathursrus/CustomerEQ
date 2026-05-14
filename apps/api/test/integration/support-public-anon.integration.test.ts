/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createSupportWidgetConfig,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('POST /v1/public/support/conversations — anonymous flow', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('creates a conversation with anonId when no Bearer + anonAllowed=true', async () => {
    const brand = await createBrand({ name: 'AnonBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_test_abc123def',
        initialMessage: 'Hi, do you ship to Canada?',
      })
    expect(res.status).toBe(201)
    expect(res.body.conversationId).toBeTruthy()
    const conv = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.anonId).toBe('anon_test_abc123def')
    expect(conv.memberId).toBeNull()
    expect(conv.brandId).toBe(brand.id)
  })

  it('rejects anonymous when anonAllowed=false on the brand', async () => {
    const brand = await createBrand({ name: 'NoAnonBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: false })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ anonId: 'anon_xyz', initialMessage: 'hello' })
    expect(res.status).toBe(403)
  })

  it('rejects anonymous when no anonId provided', async () => {
    const brand = await createBrand({ name: 'NoIdBrand' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ initialMessage: 'hello' })
    expect(res.status).toBe(400)
  })

  it('accepts optional email on anonymous flow and stores it', async () => {
    const brand = await createBrand({ name: 'AnonWithEmail' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({ anonId: 'anon_e1_with_email', email: 'visitor@example.com', initialMessage: 'hello' })
    expect(res.status).toBe(201)
    const conv = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.email).toBe('visitor@example.com')
    expect(conv.anonId).toBe('anon_e1_with_email')
  })
})
