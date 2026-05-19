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

/**
 * Compliance gate on anonymous conversation creation. When the widget captures
 * `email` from a visitor on a brand with `consentMode = EXPLICIT`, the request
 * must include `consent: true` proving the visitor acknowledged the disclosure.
 * For IMPLIED_ON_SUBMIT brands or no-email submissions, the gate is a no-op.
 */
describe('POST /v1/public/support/conversations — consent gate', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('rejects email capture on EXPLICIT brand without consent flag', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'ExplicitBrand' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { consentMode: 'EXPLICIT' },
    })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_no_consent_attempt',
        email: 'visitor@example.com',
        initialMessage: 'I want to leave my email but I have not consented',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('CONSENT_REQUIRED')
  })

  it('accepts email capture on EXPLICIT brand when consent is provided', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'ExplicitWithConsentBrand' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { consentMode: 'EXPLICIT' },
    })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_with_consent_attempt',
        email: 'visitor@example.com',
        consent: true,
        initialMessage: 'I gave consent so capture my email',
      })

    expect(res.status).toBe(201)
    const conv = await prisma.conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.email).toBe('visitor@example.com')
    expect(conv.anonId).toBe('anon_with_consent_attempt')
  })

  it('accepts anonymous conversation WITHOUT email on EXPLICIT brand (no consent required)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'ExplicitNoEmailBrand' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { consentMode: 'EXPLICIT' },
    })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_no_email_at_all',
        initialMessage: 'No email captured, no consent gate fires',
      })

    expect(res.status).toBe(201)
  })

  it('accepts email capture on IMPLIED_ON_SUBMIT brand without consent flag', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'ImpliedBrand' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { consentMode: 'IMPLIED_ON_SUBMIT' },
    })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('X-Brand-Id', brand.id)
      .send({
        anonId: 'anon_implied_email_capture',
        email: 'visitor@example.com',
        initialMessage: 'Implied mode means submitting IS consent',
      })

    expect(res.status).toBe(201)
    const conv = await prisma.conversation.findUniqueOrThrow({
      where: { id: res.body.conversationId },
    })
    expect(conv.email).toBe('visitor@example.com')
  })

  it('does not gate the Bearer flow (host page is the consent authority)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'BearerExplicitBrand' })
    await prisma.brand.update({
      where: { id: brand.id },
      data: { consentMode: 'EXPLICIT' },
    })
    const member = await createMember({
      brandId: brand.id,
      email: 'bearer-user@example.com',
    })
    // Bearer flow auth uses the email as the externalId — verify the member's
    // externalId matches the email we'll send.
    expect(member.externalId).toBe('bearer-user@example.com')

    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations')
      .set('Authorization', 'Bearer bearer-user@example.com')
      .set('X-Brand-Id', brand.id)
      .send({
        memberEmail: 'bearer-user@example.com',
        initialMessage: 'Bearer flow bypasses widget consent gate',
      })

    expect(res.status).toBe(201)
  })
})
