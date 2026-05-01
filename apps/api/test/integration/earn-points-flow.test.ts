/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'

// The loyalty event processor imports prisma directly from @customerEQ/database,
// not from the Fastify plugin mock in setup.ts. This mock routes it to the same
// isolated test-schema DB so balance assertions see consistent state.
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
  createProgramWithRules,
  createConsentedMember,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
  toHavePointsBalance,
  toHaveLoyaltyEventCount,
} from '@customerEQ/config/test-utils'
import { processLoyaltyEvent } from '../../../worker/src/processors/loyaltyEvents.js'
import type { Job } from 'bullmq'
import type { LoyaltyEventPayload } from '@customerEQ/shared'

// Register the real processor once per file. InMemoryQueue.clear() in beforeEach
// clears jobs but not processors, so this registration persists across tests.
InMemoryQueue.register(
  'loyalty-events',
  (job) => processLoyaltyEvent(job as unknown as Job<LoyaltyEventPayload>),
)

describe('Earn Points — Full Flow (API → queue → DB)', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ---------------------------------------------------------------------------
  // Happy path: balance increments and LoyaltyEvent record is written atomically
  // ---------------------------------------------------------------------------

  it('increments pointsBalance by the earning rule amount after queue drain', async () => {
    const brand = await createBrand()
    const { program } = await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-001', amount: 50 },
      idempotencyKey: `earn-balance-${Date.now()}`,
    })
    expect(res.status).toBe(202)

    await InMemoryQueue.drain('loyalty-events')

    await toHavePointsBalance(getTestPrisma(), member.id, 100)
  })

  it('writes a LoyaltyEvent record with correct pointsEarned and eventType', async () => {
    const brand = await createBrand()
    const { program } = await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 150 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)
    const idempotencyKey = `earn-record-${Date.now()}`

    await request.post('/v1/events').send({
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-002', amount: 75 },
      idempotencyKey,
    })

    await InMemoryQueue.drain('loyalty-events')

    const prisma = getTestPrisma()
    const event = await prisma.loyaltyEvent.findFirstOrThrow({
      where: { memberId: member.id, idempotencyKey },
    })

    expect(event.pointsEarned).toBe(150)
    expect(event.eventType).toBe('cx.purchase_completed')
    expect(event.brandId).toBe(brand.id)
  })

  // ---------------------------------------------------------------------------
  // Idempotency: same key sent twice must not double-earn
  // ---------------------------------------------------------------------------

  it('does not double-earn when the same idempotency key is sent twice', async () => {
    const brand = await createBrand()
    const { program } = await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)
    const idempotencyKey = `idempotent-earn-${Date.now()}`
    const body = {
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-003', amount: 50 },
      idempotencyKey,
    }

    const first = await request.post('/v1/events').send(body)
    expect(first.status).toBe(202)
    await InMemoryQueue.drain('loyalty-events')

    const second = await request.post('/v1/events').send(body)
    expect(second.status).toBe(200)
    expect(second.body.cached).toBe(true)
    await InMemoryQueue.drain('loyalty-events')

    // Balance must be exactly 100, not 200
    await toHavePointsBalance(getTestPrisma(), member.id, 100)
    // Exactly one LoyaltyEvent record written
    await toHaveLoyaltyEventCount(getTestPrisma(), member.id, 'cx.purchase_completed', 1)
  })

  // ---------------------------------------------------------------------------
  // No matching rule: event accepted but balance stays 0
  // ---------------------------------------------------------------------------

  it('does not change pointsBalance when no earning rule matches the event type', async () => {
    const brand = await createBrand()
    const { program } = await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.nps_submitted', pointsAwarded: 50 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-004', amount: 30 },
      idempotencyKey: `no-rule-${Date.now()}`,
    })
    expect(res.status).toBe(202)

    await InMemoryQueue.drain('loyalty-events')

    await toHavePointsBalance(getTestPrisma(), member.id, 0)
  })

  // ---------------------------------------------------------------------------
  // Consent gate: event rejected at the API before reaching the queue
  // ---------------------------------------------------------------------------

  it('returns 422 and does not enqueue when member has no consent', async () => {
    const brand = await createBrand()
    await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100 }],
    })
    // createConsentedMember not used — consentGivenAt defaults to null
    const { createMember } = await import('@customerEQ/config/test-utils')
    const member = await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-005', amount: 50 },
      idempotencyKey: `no-consent-${Date.now()}`,
    })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/consent/i)
    expect(InMemoryQueue.getJobs('loyalty-events')).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Multiplier: points scaled correctly by earning rule multiplier
  // ---------------------------------------------------------------------------

  it('applies the earning rule multiplier when computing points awarded', async () => {
    const brand = await createBrand()
    const { program } = await createProgramWithRules({
      brandId: brand.id,
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100, multiplier: 2.0 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    await request.post('/v1/events').send({
      eventType: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord-006', amount: 100 },
      idempotencyKey: `multiplier-${Date.now()}`,
    })

    await InMemoryQueue.drain('loyalty-events')

    await toHavePointsBalance(getTestPrisma(), member.id, 200)
  })
})
