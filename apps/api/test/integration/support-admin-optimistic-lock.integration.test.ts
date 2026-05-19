/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createMember,
  createConversation,
  authenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

// Spec §7 invariant: agent collision guarded by optimistic concurrency on
// Conversation.updatedAt. Two agents replying to the same conversation should
// not silently overwrite each other — second writer gets 409 STALE.
describe('PATCH /v1/support/conversations/:id — optimistic concurrency', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('accepts a status change when expectedUpdatedAt matches', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'LockBrand1' })
    const member = await createMember({ brandId: brand.id })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const fresh = await prisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
      select: { updatedAt: true },
    })

    const req = authenticatedRequest(brand.id)
    const res = await req
      .patch(`/v1/support/conversations/${conv.id}`)
      .send({
        status: 'RESOLVED',
        expectedUpdatedAt: fresh.updatedAt.toISOString(),
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('RESOLVED')
  })

  it('returns 409 when expectedUpdatedAt does not match (another agent already wrote)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'LockBrand2' })
    const member = await createMember({ brandId: brand.id })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    // Simulate another agent's write that bumped updatedAt
    await new Promise((r) => setTimeout(r, 5))
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { topic: 'agent-2-set-this' },
    })

    // Caller passes the ORIGINAL updatedAt — should be stale now
    const staleTimestamp = conv.updatedAt.toISOString()

    const req = authenticatedRequest(brand.id)
    const res = await req
      .patch(`/v1/support/conversations/${conv.id}`)
      .send({
        status: 'RESOLVED',
        expectedUpdatedAt: staleTimestamp,
      })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/another agent/i)
    expect(res.body.currentUpdatedAt).toBeTruthy()

    // Status was NOT changed
    const after = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })
    expect(after.status).toBe('ACTIVE') // default seeded by factory
  })

  it('accepts a status change when expectedUpdatedAt is omitted (backwards compat)', async () => {
    const brand = await createBrand({ name: 'LockBrand3' })
    const member = await createMember({ brandId: brand.id })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const req = authenticatedRequest(brand.id)
    const res = await req
      .patch(`/v1/support/conversations/${conv.id}`)
      .send({ status: 'RESOLVED' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('RESOLVED')
  })

  it('accepts epoch-millis number as expectedUpdatedAt (UI convenience)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'LockBrand4' })
    const member = await createMember({ brandId: brand.id })
    const conv = await createConversation({ brandId: brand.id, memberId: member.id })

    const fresh = await prisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
      select: { updatedAt: true },
    })

    const req = authenticatedRequest(brand.id)
    const res = await req
      .patch(`/v1/support/conversations/${conv.id}`)
      .send({
        status: 'RESOLVED',
        expectedUpdatedAt: fresh.updatedAt.getTime(),
      })

    expect(res.status).toBe(200)
  })
})
