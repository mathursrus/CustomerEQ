/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSlaBreachCheck } from './slaBreachCheck.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRAND_ID = 'brand-001'
const CASE_ID = 'case-001'

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    caseFollowUp: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    webhookEndpoint: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
}

function makeEnqueue() {
  return vi.fn().mockResolvedValue(undefined)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runSlaBreachCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns processed:0 and enqueues nothing when no overdue cases exist', async () => {
    const prisma = makePrisma()
    const enqueue = makeEnqueue()

    const result = await runSlaBreachCheck(prisma as never, enqueue)

    expect(result.processed).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('queries only cases with slaBreachedAt=null (DB-level dedup)', async () => {
    const prisma = makePrisma()
    const enqueue = makeEnqueue()

    await runSlaBreachCheck(prisma as never, enqueue)

    const where = prisma.caseFollowUp.findMany.mock.calls[0][0].where
    expect(where.slaBreachedAt).toBeNull()
  })

  it('queries only OPEN and CONTACTED cases', async () => {
    const prisma = makePrisma()

    await runSlaBreachCheck(prisma as never, makeEnqueue())

    const where = prisma.caseFollowUp.findMany.mock.calls[0][0].where
    expect(where.status).toEqual({ in: ['OPEN', 'CONTACTED'] })
  })

  it('queries only cases with slaDeadline in the past', async () => {
    const prisma = makePrisma()

    await runSlaBreachCheck(prisma as never, makeEnqueue())

    const where = prisma.caseFollowUp.findMany.mock.calls[0][0].where
    expect(where.slaDeadline).toHaveProperty('lt')
    expect(where.slaDeadline.lt).toBeInstanceOf(Date)
  })

  it('sets slaBreachedAt before enqueueing delivery (dedup guard ordering)', async () => {
    const callOrder: string[] = []

    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([{ id: CASE_ID, brandId: BRAND_ID }]),
        update: vi.fn().mockImplementation(async () => { callOrder.push('update'); return {} }),
      },
      webhookEndpoint: {
        findMany: vi.fn().mockResolvedValue([{ id: 'ep-001' }]),
      },
    }

    const enqueue = vi.fn().mockImplementation(async () => { callOrder.push('enqueue') })

    await runSlaBreachCheck(prisma as never, enqueue)

    expect(callOrder[0]).toBe('update')
    expect(callOrder[1]).toBe('enqueue')
  })

  it('sets slaBreachedAt on the correct case ID', async () => {
    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([{ id: CASE_ID, brandId: BRAND_ID }]),
        update: vi.fn().mockResolvedValue({}),
      },
      webhookEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
    }

    await runSlaBreachCheck(prisma as never, makeEnqueue())

    const updateCall = prisma.caseFollowUp.update.mock.calls[0][0]
    expect(updateCall.where.id).toBe(CASE_ID)
    expect(updateCall.data.slaBreachedAt).toBeInstanceOf(Date)
  })

  it('enqueues case.overdue for each active endpoint subscribed to that event', async () => {
    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([{ id: CASE_ID, brandId: BRAND_ID }]),
        update: vi.fn().mockResolvedValue({}),
      },
      webhookEndpoint: {
        findMany: vi.fn().mockResolvedValue([{ id: 'ep-001' }, { id: 'ep-002' }]),
      },
    }

    const enqueue = makeEnqueue()
    await runSlaBreachCheck(prisma as never, enqueue)

    expect(enqueue).toHaveBeenCalledTimes(2)
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookEndpointId: 'ep-001', event: 'case.overdue', caseId: CASE_ID }),
    )
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookEndpointId: 'ep-002', event: 'case.overdue', caseId: CASE_ID }),
    )
  })

  it('queries endpoints with brandId, active:true, and events has case.overdue', async () => {
    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([{ id: CASE_ID, brandId: BRAND_ID }]),
        update: vi.fn().mockResolvedValue({}),
      },
      webhookEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
    }

    await runSlaBreachCheck(prisma as never, makeEnqueue())

    const epWhere = prisma.webhookEndpoint.findMany.mock.calls[0][0].where
    expect(epWhere.brandId).toBe(BRAND_ID)
    expect(epWhere.active).toBe(true)
    expect(epWhere.events).toEqual({ has: 'case.overdue' })
  })

  it('returns processed count equal to the number of overdue cases', async () => {
    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'case-a', brandId: BRAND_ID },
          { id: 'case-b', brandId: BRAND_ID },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      webhookEndpoint: { findMany: vi.fn().mockResolvedValue([{ id: 'ep-001' }]) },
    }

    const result = await runSlaBreachCheck(prisma as never, makeEnqueue())

    expect(result.processed).toBe(2)
  })

  it('continues processing remaining cases when one enqueue fails', async () => {
    const prisma = {
      caseFollowUp: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'case-a', brandId: BRAND_ID },
          { id: 'case-b', brandId: BRAND_ID },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      webhookEndpoint: { findMany: vi.fn().mockResolvedValue([{ id: 'ep-001' }]) },
    }

    let callCount = 0
    const enqueue = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('queue unavailable')
    })

    const result = await runSlaBreachCheck(prisma as never, enqueue)

    // Both cases must be processed; first enqueue failure does not abort the loop
    expect(result.processed).toBe(2)
    expect(enqueue).toHaveBeenCalledTimes(2)
  })
})
