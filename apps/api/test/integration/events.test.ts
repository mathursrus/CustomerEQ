/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupTestDb,
  teardownTestDb,
  seedTestDb,
  createBrand,
  createProgram,
  createProgramWithRules,
  createConsentedMember,
  createCampaign,
  createCxEvent,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

describe('Events API — POST /v1/events', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // -------------------------------------------------------------------------
  // Happy path — event accepted and enqueued
  // -------------------------------------------------------------------------

  it('accepts a valid event for a consented member and returns 202 with a jobId', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = await authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      type: 'cx.nps_submitted',
      memberId: member.id,
      payload: { score: 9, comment: 'Great experience' },
      idempotencyKey: `test-nps-${Date.now()}`,
    })

    expect(res.status).toBe(202)
    expect(res.body.jobId).toBeDefined()
    expect(typeof res.body.jobId).toBe('string')
  })

  it('enqueues the event to the BullMQ loyalty-events queue', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = await authenticatedRequest(brand.id)

    const idempotencyKey = `test-enqueue-${Date.now()}`

    await request.post('/v1/events').send({
      type: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord_001', amount: 50.0 },
      idempotencyKey,
    })

    const jobs = InMemoryQueue.getJobs('loyalty-events')
    const matchingJob = jobs.find((j) => j.data.idempotencyKey === idempotencyKey)

    expect(matchingJob).toBeDefined()
    expect(matchingJob!.data.memberId).toBe(member.id)
    expect(matchingJob!.data.type).toBe('cx.purchase_completed')
  })

  it('increments member pointsBalance after the worker drains the loyalty-events queue', async () => {
    const brand = await createBrand()
    const program = await createProgramWithRules({
      brandId: brand.id,
      status: 'ACTIVE',
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 100 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = await authenticatedRequest(brand.id)

    const idempotencyKey = `test-worker-${Date.now()}`

    await request.post('/v1/events').send({
      type: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord_002', amount: 75.0 },
      idempotencyKey,
    })

    // Drain the in-memory queue so the worker processes the job synchronously in tests
    await InMemoryQueue.drain('loyalty-events')

    const balanceRes = await request.get(`/v1/members/${member.id}/balance`)

    expect(balanceRes.status).toBe(200)
    expect(balanceRes.body.pointsBalance).toBe(100)
    expect(balanceRes.body.recentEvents).toHaveLength(1)
    expect(balanceRes.body.recentEvents[0].pointsEarned).toBe(100)
  })

  // -------------------------------------------------------------------------
  // Idempotency — duplicate events must not double-increment
  // -------------------------------------------------------------------------

  it('does not double-increment pointsBalance when the same idempotencyKey is submitted twice', async () => {
    const brand = await createBrand()
    const program = await createProgramWithRules({
      brandId: brand.id,
      status: 'ACTIVE',
      rules: [{ triggerEvent: 'cx.purchase_completed', pointsAwarded: 50 }],
    })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const request = await authenticatedRequest(brand.id)

    const idempotencyKey = `idempotent-key-${Date.now()}`

    const firstRes = await request.post('/v1/events').send({
      type: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord_003', amount: 20.0 },
      idempotencyKey,
    })
    expect(firstRes.status).toBe(202)

    const secondRes = await request.post('/v1/events').send({
      type: 'cx.purchase_completed',
      memberId: member.id,
      payload: { orderId: 'ord_003', amount: 20.0 },
      idempotencyKey,
    })
    expect(secondRes.status).toBe(200) // idempotent — not re-accepted

    await InMemoryQueue.drain('loyalty-events')

    const balanceRes = await request.get(`/v1/members/${member.id}/balance`)
    expect(balanceRes.body.pointsBalance).toBe(50) // awarded exactly once
  })

  // -------------------------------------------------------------------------
  // Error states
  // -------------------------------------------------------------------------

  it('returns 422 when the member has not given consent', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    // createMember without consent
    const member = await createConsentedMember({
      brandId: brand.id,
      programId: program.id,
      consentGivenAt: null,
    })
    const request = await authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      type: 'cx.nps_submitted',
      memberId: member.id,
      payload: { score: 5 },
      idempotencyKey: `no-consent-${Date.now()}`,
    })

    expect(res.status).toBe(422)
    expect(res.body.message).toMatch(/consent/i)
  })

  it('returns 404 when the memberId does not exist', async () => {
    const brand = await createBrand()
    const request = await authenticatedRequest(brand.id)

    const res = await request.post('/v1/events').send({
      type: 'cx.nps_submitted',
      memberId: '00000000-0000-0000-0000-000000000000',
      payload: { score: 7 },
      idempotencyKey: `nonexistent-${Date.now()}`,
    })

    expect(res.status).toBe(404)
  })

  // -------------------------------------------------------------------------
  // Campaign trigger — CX event matching an active campaign
  // -------------------------------------------------------------------------

  it('enqueues a job to campaign-triggers queue when a CX event matches an active campaign', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
    const campaign = await createCampaign({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      triggerEventType: 'cx.nps_submitted',
    })
    const request = await authenticatedRequest(brand.id)

    await request.post('/v1/events').send({
      type: 'cx.nps_submitted',
      memberId: member.id,
      payload: { score: 3 },
      idempotencyKey: `campaign-trigger-${Date.now()}`,
    })

    const campaignJobs = InMemoryQueue.getJobs('campaign-triggers')
    const matchingJob = campaignJobs.find(
      (j) => j.data.campaignId === campaign.id && j.data.memberId === member.id,
    )

    expect(matchingJob).toBeDefined()
    expect(matchingJob!.data.eventType).toBe('cx.nps_submitted')
  })
})
