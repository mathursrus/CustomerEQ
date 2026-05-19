/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createSupportWidgetConfig,
  createMember,
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
    // Use IMPLIED_ON_SUBMIT here so we're testing email storage in isolation,
    // not the consent gate (which has its own dedicated test file).
    const brand = await createBrand({ name: 'AnonWithEmail', consentMode: 'IMPLIED_ON_SUBMIT' })
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

  /**
   * Bearer-flow tests for the canonical brandId_externalId lookup + v1 EMAIL-only guard.
   */
  it('Bearer flow on an EMAIL brand resolves member via brandId_externalId', async () => {
    const brand = await createBrand({ name: 'BearerEmailBrand', memberIdentifierKind: 'EMAIL' })
    const member = await createMember({ brandId: brand.id, email: 'identified@example.com' })
    expect(member.externalId).toBe('identified@example.com')

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('Authorization', 'Bearer identified@example.com')
      .set('X-Brand-Id', brand.id)
      .send({
        memberEmail: 'identified@example.com',
        initialMessage: 'Bearer flow resolves to the member row',
      })
    expect(res.status).toBe(201)
    const conv = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.memberId).toBe(member.id)
    expect(conv.brandId).toBe(brand.id)
  })

  it('Bearer flow on a PHONE brand returns 422 IDENTIFIER_KIND_UNSUPPORTED', async () => {
    const brand = await createBrand({ name: 'PhoneBrand', memberIdentifierKind: 'PHONE' })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('Authorization', 'Bearer someone@example.com')
      .set('X-Brand-Id', brand.id)
      .send({
        memberEmail: 'someone@example.com',
        initialMessage: 'Phone-keyed brand should reject the Bearer/email path',
      })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('IDENTIFIER_KIND_UNSUPPORTED')
  })

  it('Bearer flow without X-Brand-Id returns 400', async () => {
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('Authorization', 'Bearer needs-brand@example.com')
      .send({
        memberEmail: 'needs-brand@example.com',
        initialMessage: 'Missing X-Brand-Id must fail fast',
      })
    expect(res.status).toBe(400)
  })
})
