/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockPrisma } from '@customerEQ/config/test-utils'
import { createCampaignTriggerProcessor, evaluateTriggerCondition } from './campaignTriggers.js'

// ---------------------------------------------------------------------------
// Module mocks — use shared factories from test-utils (async import for hoisting)
// ---------------------------------------------------------------------------

vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

vi.mock('../queues/producers.js', () => ({
  enqueueNotification: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Typed references to mocked modules
// ---------------------------------------------------------------------------

import { prisma } from '@customerEQ/database'
import { enqueueNotification } from '../queues/producers.js'
const mockPrisma = prisma as unknown as MockPrisma
const mockEnqueueNotification = enqueueNotification as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Mock Redis (uses shared createMockRedis pattern)
// ---------------------------------------------------------------------------

function makeMockRedis() {
  return {
    set: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-001',
    name: 'Test Campaign',
    status: 'ACTIVE',
    actionType: 'award_points',
    actionConfig: { points: 100 },
    budgetCap: null,
    budgetSpent: 0,
    program: { pointToCurrencyRatio: 0.01 },
    ...overrides,
  }
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      campaignId: 'campaign-001',
      memberId: 'member-abc',
      brandId: 'brand-xyz',
      eventIngestedAt: new Date(Date.now() - 500).toISOString(),
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests: createCampaignTriggerProcessor
// ---------------------------------------------------------------------------

describe('createCampaignTriggerProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        loyaltyEvent: { create: vi.fn() },
        member: { update: vi.fn() },
        campaignEvent: { create: vi.fn() },
        campaign: { update: vi.fn() },
      }),
    )
  })

  describe('deduplication', () => {
    it('executes when redis SET NX succeeds (new key)', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK') // SET NX returned OK — new key
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(makeCampaign())

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.executed).toBe(true)
    })

    it('skips with reason "already_triggered" when redis SET NX returns null (key exists)', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue(null) // SET NX returned null — key already exists

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('already_triggered')
    })

    it('does not fetch campaign when dedup key already exists', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue(null)

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      await processor(makeJob() as never)

      expect(mockPrisma.campaign.findUniqueOrThrow).not.toHaveBeenCalled()
    })
  })

  describe('campaign status guard', () => {
    it('skips with reason "campaign_inactive" when campaign status is INACTIVE', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(makeCampaign({ status: 'INACTIVE' }))

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('campaign_inactive')
    })

    it('skips with reason "campaign_inactive" when campaign status is PAUSED', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(makeCampaign({ status: 'PAUSED' }))

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('campaign_inactive')
    })
  })

  describe('budget cap enforcement', () => {
    it('skips with reason "budget_cap_reached" when budgetSpent + action cost exceeds budgetCap', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      // points=100, ratio=0.01, cost=$1.00, budgetSpent=$500, cap=$500 → over cap
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ budgetCap: 500, budgetSpent: 500, actionConfig: { points: 100 } }),
      )
      mockPrisma.campaign.update.mockResolvedValue({})

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('budget_cap_reached')
    })

    it('pauses the campaign when budget cap is reached', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ budgetCap: 200, budgetSpent: 200, actionConfig: { points: 100 } }),
      )
      mockPrisma.campaign.update.mockResolvedValue({})

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      await processor(makeJob() as never)

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-001' },
          data: expect.objectContaining({ status: 'PAUSED' }),
        }),
      )
    })

    it('executes normally when budgetCap is null (unlimited budget)', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ budgetCap: null, budgetSpent: 9999 }),
      )

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.executed).toBe(true)
    })
  })

  describe('points awarded', () => {
    it('returns the correct points from actionConfig.points', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ actionConfig: { points: 250 } }),
      )

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.points).toBe(250)
    })

    it('returns 0 points when actionConfig has no points field', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ actionConfig: { message: 'Hi!' } }),
      )

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob() as never)

      expect(result.points).toBe(0)
    })
  })

  describe('latency measurement', () => {
    it('records a positive latencyMs value', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(makeCampaign())

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob({ eventIngestedAt: new Date(Date.now() - 500).toISOString() }) as never)

      expect(result.latencyMs).toBeDefined()
      expect(result.latencyMs!).toBeGreaterThan(0)
    })

    it('latencyMs is within a reasonable bound', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(makeCampaign())

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      const result = await processor(makeJob({ eventIngestedAt: new Date(Date.now() - 100).toISOString() }) as never)

      expect(result.latencyMs!).toBeGreaterThanOrEqual(100)
      expect(result.latencyMs!).toBeLessThan(10_000)
    })
  })

  describe('notification enqueuing', () => {
    it('enqueues a notification when actionConfig has a message field', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ actionConfig: { message: 'Congrats!' } }),
      )
      mockEnqueueNotification.mockResolvedValue({})

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      await processor(makeJob() as never)

      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1)
    })

    it('passes the correct memberId and message to enqueueNotification', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ actionConfig: { message: 'You unlocked Gold tier!' } }),
      )
      mockEnqueueNotification.mockResolvedValue({})

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      await processor(makeJob({ memberId: 'member-notify-test' }) as never)

      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          memberId: 'member-notify-test',
          message: 'You unlocked Gold tier!',
        }),
      )
    })

    it('does not enqueue a notification when actionConfig has no message', async () => {
      const mockRedis = makeMockRedis()
      mockRedis.set.mockResolvedValue('OK')
      mockPrisma.campaign.findUniqueOrThrow.mockResolvedValue(
        makeCampaign({ actionConfig: { points: 100 } }),
      )

      const processor = createCampaignTriggerProcessor(mockRedis as never)
      await processor(makeJob() as never)

      expect(mockEnqueueNotification).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: evaluateTriggerCondition (pure function)
// ---------------------------------------------------------------------------

describe('evaluateTriggerCondition', () => {
  it('eq: returns true when field equals value', () => {
    expect(evaluateTriggerCondition({ field: 'score', op: 'eq', value: 9 }, { score: 9 })).toBe(true)
  })

  it('eq: returns false when field does not equal value', () => {
    expect(evaluateTriggerCondition({ field: 'score', op: 'eq', value: 9 }, { score: 8 })).toBe(false)
  })

  it('ne: returns true when field does not equal value', () => {
    expect(evaluateTriggerCondition({ field: 'status', op: 'ne', value: 'closed' }, { status: 'open' })).toBe(true)
  })

  it('lt: returns true when field is less than value', () => {
    expect(evaluateTriggerCondition({ field: 'score', op: 'lt', value: 5 }, { score: 3 })).toBe(true)
  })

  it('lt: returns false when field equals value', () => {
    expect(evaluateTriggerCondition({ field: 'score', op: 'lt', value: 5 }, { score: 5 })).toBe(false)
  })

  it('lte: returns true when field equals value', () => {
    expect(evaluateTriggerCondition({ field: 'score', op: 'lte', value: 5 }, { score: 5 })).toBe(true)
  })

  it('gt: returns true when field is greater than value', () => {
    expect(evaluateTriggerCondition({ field: 'amount', op: 'gt', value: 100 }, { amount: 150 })).toBe(true)
  })

  it('gte: returns true when field equals value', () => {
    expect(evaluateTriggerCondition({ field: 'amount', op: 'gte', value: 100 }, { amount: 100 })).toBe(true)
  })

  it('in: returns true when field value is in the array', () => {
    expect(evaluateTriggerCondition({ field: 'tier', op: 'in', value: ['gold', 'platinum'] }, { tier: 'gold' })).toBe(true)
  })

  it('in: returns false when field value is not in the array', () => {
    expect(evaluateTriggerCondition({ field: 'tier', op: 'in', value: ['gold', 'platinum'] }, { tier: 'silver' })).toBe(false)
  })

  it('contains: returns true when string field contains value', () => {
    expect(evaluateTriggerCondition({ field: 'note', op: 'contains', value: 'great' }, { note: 'great service' })).toBe(true)
  })

  it('unknown op: returns false', () => {
    expect(evaluateTriggerCondition({ field: 'x', op: 'unknown_op', value: 1 }, { x: 1 })).toBe(false)
  })
})
