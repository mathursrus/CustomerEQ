/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'

// resolveConversation imports prisma directly from @customerEQ/database (not the
// Fastify plugin). Route it to the same isolated test-schema DB so all assertions
// see consistent state.
vi.mock('@customerEQ/database', async () => {
  const { getTestPrisma } = await import('@customerEQ/config/test-utils')
  return {
    get prisma() {
      return getTestPrisma()
    },
  }
})

import {
  seedTestDb,
  createBrand,
  createMember,
  createConversation,
  createSupportWidgetConfig,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('POST /v1/public/support/conversations/:id/csat', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // ─── Test 1: THUMBS_UP on identified conversation ──────────────────────────
  it('resolves an identified conversation with THUMBS_UP and emits loyalty event', async () => {
    const brand = await createBrand({ name: 'CsatBrand1' })
    const member = await createMember({ brandId: brand.id, email: 'csat1@example.com' })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const req = unauthenticatedRequest()
    const res = await req
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_UP' })

    expect(res.status).toBe(200)
    expect(res.body.rating).toBe('THUMBS_UP')
    expect(res.body.resolved).toBe(true)
    expect(res.body.loyaltyEventEmitted).toBe(true)

    const updated = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: conv.id },
      include: { csatResponse: true },
    })
    expect(updated.status).toBe('RESOLVED')
    expect(updated.resolutionSource).toBe('CSAT')
    expect(updated.csatResponse).toBeTruthy()
    expect(updated.csatResponse?.rating).toBe('THUMBS_UP')
  })

  // ─── Test 2: THUMBS_UP on anonymous conversation — no loyalty event ─────────
  it('resolves an anonymous conversation with THUMBS_UP but does not emit loyalty event', async () => {
    const brand = await createBrand({ name: 'CsatBrand2' })
    await createSupportWidgetConfig({ brandId: brand.id, anonAllowed: true })

    const conv = await getTestPrisma().conversation.create({
      data: {
        brandId: brand.id,
        memberId: null,
        anonId: 'anon_csat_test_xyz',
        status: 'ACTIVE',
        channel: 'WIDGET',
      },
    })

    const req = unauthenticatedRequest()
    const res = await req
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_UP', anonId: 'anon_csat_test_xyz' })

    expect(res.status).toBe(200)
    expect(res.body.resolved).toBe(true)
    expect(res.body.loyaltyEventEmitted).toBe(false)

    const updated = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: conv.id },
    })
    expect(updated.status).toBe('RESOLVED')
  })

  // ─── Test 3: THUMBS_DOWN — identified conversation, does NOT resolve ────────
  it('records THUMBS_DOWN but leaves conversation in WAITING_ON_CUSTOMER and does not emit loyalty event', async () => {
    const brand = await createBrand({ name: 'CsatBrand3' })
    const member = await createMember({ brandId: brand.id, email: 'csat3@example.com' })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const req = unauthenticatedRequest()
    const res = await req
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_DOWN' })

    expect(res.status).toBe(200)
    expect(res.body.resolved).toBe(false)

    const updated = await getTestPrisma().conversation.findUniqueOrThrow({
      where: { id: conv.id },
      include: { csatResponse: true },
    })
    expect(updated.status).toBe('WAITING_ON_CUSTOMER')
    expect(updated.csatResponse).toBeTruthy()
    expect(updated.csatResponse?.rating).toBe('THUMBS_DOWN')
  })

  // ─── Test 4: Double-submit idempotent ──────────────────────────────────────
  it('returns idempotent:true on second submit and does not create a second CSATResponse row', async () => {
    const brand = await createBrand({ name: 'CsatBrand4' })
    const member = await createMember({ brandId: brand.id, email: 'csat4@example.com' })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const req = unauthenticatedRequest()

    // First submit
    const res1 = await req
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_UP' })
    expect(res1.status).toBe(200)
    expect(res1.body.idempotent).toBeUndefined()
    expect(res1.body.rating).toBe('THUMBS_UP')

    // Second submit
    const req2 = unauthenticatedRequest()
    const res2 = await req2
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_UP' })
    expect(res2.status).toBe(200)
    expect(res2.body.idempotent).toBe(true)
    expect(res2.body.rating).toBe('THUMBS_UP')

    // Only one CSATResponse row should exist
    const count = await getTestPrisma().cSATResponse.count({
      where: { conversationId: conv.id },
    })
    expect(count).toBe(1)
  })

  // ─── Test 5: Wrong anonId → 403 ─────────────────────────────────────────
  it('returns 403 when anonId does not match the conversation', async () => {
    const brand = await createBrand({ name: 'CsatBrand5' })

    const conv = await getTestPrisma().conversation.create({
      data: {
        brandId: brand.id,
        memberId: null,
        anonId: 'anon_real_id',
        status: 'ACTIVE',
        channel: 'WIDGET',
      },
    })

    const req = unauthenticatedRequest()
    const res = await req
      .post(`/v1/public/support/conversations/${conv.id}/csat`)
      .send({ rating: 'THUMBS_UP', anonId: 'wrong_id' })

    expect(res.status).toBe(403)
  })

  // ─── Test 6: Nonexistent conversation → 404 ──────────────────────────────
  it('returns 404 for a nonexistent conversation id', async () => {
    const req = unauthenticatedRequest()
    const res = await req
      .post('/v1/public/support/conversations/does_not_exist/csat')
      .send({ rating: 'THUMBS_UP' })

    expect(res.status).toBe(404)
  })
})
