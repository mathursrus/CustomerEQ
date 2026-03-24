/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Type definitions that mirror the implementation contract.
// ---------------------------------------------------------------------------

type CampaignStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED'

type Campaign = {
  id: string
  name: string
  status: CampaignStatus
  actionType: string
  actionConfig: Record<string, unknown>
  budgetCap: number | null
  budgetSpent: number
}

type TriggerInput = {
  memberId: string
  brandId: string
  eventType: string
  campaignId: string
  payload: Record<string, unknown>
  triggeredAt: Date
}

type TriggerResult = {
  status: 'executed' | 'skipped'
  reason?: string
  pointsAwarded?: number
  latencyMs?: number
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

// Prisma mock — each test overrides the methods it needs
const mockPrisma = {
  campaign: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  campaignExecution: {
    create: vi.fn(),
  },
  memberPointLedger: {
    create: vi.fn(),
  },
  member: {
    update: vi.fn(),
  },
}

// Redis mock — tracks dedup keys
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  incrbyfloat: vi.fn(),
}

// Notification queue mock
const mockNotificationQueue = {
  add: vi.fn(),
}

// ---------------------------------------------------------------------------
// The processor under test.
//
// The real implementation will live in `./campaignTriggers` and will be
// imported once it exists.  We inline a skeletal version here so the file is
// syntactically valid TypeScript and the tests express the expected contract.
// ---------------------------------------------------------------------------

async function processCampaignTrigger(
  input: TriggerInput,
  deps: {
    prisma: typeof mockPrisma
    redis: typeof mockRedis
    notificationQueue: typeof mockNotificationQueue
  },
): Promise<TriggerResult> {
  throw new Error('processCampaignTrigger is not yet implemented')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'campaign-001',
    name: 'Test Campaign',
    status: 'ACTIVE',
    actionType: 'award_points',
    actionConfig: { pointsAwarded: 100 },
    budgetCap: null,
    budgetSpent: 0,
    ...overrides,
  }
}

function makeTriggerInput(overrides: Partial<TriggerInput> = {}): TriggerInput {
  return {
    memberId: 'member-abc',
    brandId: 'brand-xyz',
    eventType: 'purchase',
    campaignId: 'campaign-001',
    payload: { orderId: 'ord-001', amount: 75 },
    triggeredAt: new Date('2026-03-24T10:00:00.000Z'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processCampaignTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deduplication', () => {
    it('executes the campaign action when the trigger has not been seen before', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null) // not in dedup set
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-001' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('executed')
    })

    it('skips processing with reason "already_triggered" when the dedup key exists in Redis', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue('1') // already in dedup set

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('already_triggered')
    })

    it('stores the dedup key in Redis after a successful execution', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-002' })

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('does not write to the dedup set when the trigger is a duplicate', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue('1')

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockRedis.set).not.toHaveBeenCalled()
    })
  })

  describe('campaign status guard', () => {
    it('skips with reason "campaign_inactive" when campaign status is INACTIVE', async () => {
      const campaign = makeCampaign({ status: 'INACTIVE' })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('campaign_inactive')
    })

    it('skips with reason "campaign_inactive" when campaign status is PAUSED', async () => {
      const campaign = makeCampaign({ status: 'PAUSED' })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('campaign_inactive')
    })
  })

  describe('budget cap enforcement', () => {
    it('pauses the campaign and returns skipped when budgetSpent has reached budgetCap', async () => {
      const campaign = makeCampaign({ budgetCap: 500, budgetSpent: 500 })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaign.update.mockResolvedValue({ ...campaign, status: 'PAUSED' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('budget_cap_reached')
    })

    it('calls prisma.campaign.update to set status to PAUSED when budget cap is reached', async () => {
      const campaign = makeCampaign({ budgetCap: 200, budgetSpent: 200 })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaign.update.mockResolvedValue({ ...campaign, status: 'PAUSED' })

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaign.id },
          data: expect.objectContaining({ status: 'PAUSED' }),
        }),
      )
    })

    it('executes and increments budgetSpent when budget cap has not been reached', async () => {
      const campaign = makeCampaign({ budgetCap: 1000, budgetSpent: 400, actionConfig: { pointsAwarded: 100 } })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-003' })
      mockPrisma.campaign.update.mockResolvedValue({ ...campaign, budgetSpent: 500 })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('executed')
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaign.id },
          data: expect.objectContaining({ budgetSpent: expect.any(Number) }),
        }),
      )
    })

    it('executes normally when budgetCap is null (unlimited budget)', async () => {
      const campaign = makeCampaign({ budgetCap: null, budgetSpent: 9999 })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-004' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.status).toBe('executed')
    })
  })

  describe('points awarded', () => {
    it('returns the correct pointsAwarded from actionConfig for an award_points action', async () => {
      const campaign = makeCampaign({ actionType: 'award_points', actionConfig: { pointsAwarded: 250 } })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-005' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.pointsAwarded).toBe(250)
    })

    it('returns 0 pointsAwarded for a non-award_points action type', async () => {
      const campaign = makeCampaign({ actionType: 'send_notification', actionConfig: { message: 'Hi!' } })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-006' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.pointsAwarded).toBe(0)
    })
  })

  describe('latency measurement', () => {
    it('records a positive latencyMs value in the result', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput({ triggeredAt: new Date(Date.now() - 500) }) // 500 ms ago

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-007' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(result.latencyMs).toBeDefined()
      expect(result.latencyMs!).toBeGreaterThan(0)
    })

    it('latencyMs is within a reasonable bound for a trigger with a recent triggeredAt', async () => {
      const campaign = makeCampaign()
      const input = makeTriggerInput({ triggeredAt: new Date(Date.now() - 100) })

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-008' })

      const result = await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      // latency must be >= the time difference to triggeredAt, with some tolerance
      expect(result.latencyMs!).toBeGreaterThanOrEqual(100)
      // Sanity ceiling: unit test should not be processing for more than 10 seconds
      expect(result.latencyMs!).toBeLessThan(10_000)
    })
  })

  describe('notification enqueuing', () => {
    it('enqueues a notification job when actionType is send_notification and message is in actionConfig', async () => {
      const campaign = makeCampaign({
        actionType: 'send_notification',
        actionConfig: { message: 'Congrats! You earned a reward.' },
      })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-009' })

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockNotificationQueue.add).toHaveBeenCalledTimes(1)
    })

    it('passes the correct memberId and message to the notification queue job', async () => {
      const campaign = makeCampaign({
        actionType: 'send_notification',
        actionConfig: { message: 'You unlocked Gold tier!' },
      })
      const input = makeTriggerInput({ memberId: 'member-notify-test' })

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-010' })

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          memberId: 'member-notify-test',
          message: 'You unlocked Gold tier!',
        }),
      )
    })

    it('does not enqueue a notification when actionType is award_points', async () => {
      const campaign = makeCampaign({ actionType: 'award_points', actionConfig: { pointsAwarded: 100 } })
      const input = makeTriggerInput()

      mockPrisma.campaign.findUnique.mockResolvedValue(campaign)
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.campaignExecution.create.mockResolvedValue({ id: 'exec-011' })

      await processCampaignTrigger(input, {
        prisma: mockPrisma,
        redis: mockRedis,
        notificationQueue: mockNotificationQueue,
      })

      expect(mockNotificationQueue.add).not.toHaveBeenCalled()
    })
  })
})
