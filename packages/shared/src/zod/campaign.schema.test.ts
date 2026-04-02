/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateCampaignSchema,
  SpinWheelSegmentSchema,
  SpinWheelConfigSchema,
} from './campaign.schema'

describe('CreateCampaignSchema', () => {
  // The real schema uses z.string().datetime() for dates (ISO strings, not Date objects)
  // triggerCondition.op must be one of: 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains'
  // actionType must be one of: 'award_points', 'award_reward', 'send_message'
  // actionConfig must contain either `points` or `rewardId` (schema refine)

  const validTriggerCondition = {
    field: 'eventType',
    op: 'eq' as const,
    value: 'purchase',
  }

  const validActionConfig = {
    points: 100,
    message: 'You earned 100 points!',
  }

  const requiredBase = {
    name: 'Summer Sale Bonus',
    programId: 'prog-abc-123',
    triggerType: 'event',
    triggerCondition: validTriggerCondition,
    actionType: 'award_points' as const,
    actionConfig: validActionConfig,
    startDate: '2026-06-01T00:00:00.000Z',
  }

  describe('valid inputs', () => {
    it('accepts a fully populated campaign with all optional fields', () => {
      const input = {
        ...requiredBase,
        endDate: '2026-08-31T23:59:59.000Z',
        budgetCap: 5000,
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a minimal campaign with only required fields and no optional ones', () => {
      const result = CreateCampaignSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
    })

    it('accepts a campaign without endDate (open-ended campaign)', () => {
      const input = {
        ...requiredBase,
        actionType: 'send_message' as const,
        actionConfig: { rewardId: 'reward-001', message: 'Welcome to gold tier' },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a campaign without budgetCap (unlimited budget)', () => {
      const result = CreateCampaignSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
    })

    it('accepts a campaign with a budgetCap of 1 (minimum positive value)', () => {
      const input = { ...requiredBase, budgetCap: 1 }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a triggerCondition using the gte operator with a numeric value', () => {
      const input = {
        ...requiredBase,
        triggerCondition: { field: 'amount', op: 'gte' as const, value: 100 },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts a triggerCondition using the in operator with an array value', () => {
      const input = {
        ...requiredBase,
        triggerCondition: { field: 'tier', op: 'in' as const, value: ['gold', 'platinum'] },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts actionConfig with only rewardId (satisfies refine)', () => {
      const input = {
        ...requiredBase,
        actionType: 'award_reward' as const,
        actionConfig: { rewardId: 'reward-xyz' },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('accepts actionConfig with only points (satisfies refine)', () => {
      const result = CreateCampaignSchema.safeParse(requiredBase)

      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects when name is missing', () => {
      const { name: _removed, ...input } = requiredBase as typeof requiredBase & { name?: string }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects an empty name string', () => {
      const input = { ...requiredBase, name: '' }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('name'))).toBe(true)
    })

    it('rejects when triggerType is missing', () => {
      const { triggerType: _removed, ...input } = requiredBase as typeof requiredBase & {
        triggerType?: string
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('triggerType'))).toBe(true)
    })

    it('accepts when triggerCondition is missing (optional)', () => {
      const { triggerCondition: _removed, ...input } = requiredBase as typeof requiredBase & {
        triggerCondition?: object
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('rejects when triggerCondition.op is not a valid enum value', () => {
      const input = {
        ...requiredBase,
        triggerCondition: { field: 'eventType', op: 'not_a_real_op', value: 'purchase' },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(
        result.error?.issues.some(
          (i) => i.path.includes('triggerCondition') || i.path.includes('op'),
        ),
      ).toBe(true)
    })

    it('rejects when triggerCondition is not an object (string provided)', () => {
      const input = { ...requiredBase, triggerCondition: 'not-an-object' }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('triggerCondition'))).toBe(true)
    })

    it('rejects when actionType is not a valid enum value', () => {
      const input = { ...requiredBase, actionType: 'invalid_action_type' }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('actionType'))).toBe(true)
    })

    it('rejects when actionType is missing', () => {
      const { actionType: _removed, ...input } = requiredBase as typeof requiredBase & {
        actionType?: string
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('actionType'))).toBe(true)
    })

    it('rejects when actionConfig is missing', () => {
      const { actionConfig: _removed, ...input } = requiredBase as typeof requiredBase & {
        actionConfig?: object
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('actionConfig'))).toBe(true)
    })

    it('accepts actionConfig with only message (send_message use case)', () => {
      const input = {
        ...requiredBase,
        actionConfig: { message: 'Only a message, no points or rewardId' },
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('rejects actionConfig that has neither points, rewardId, nor message', () => {
      const input = {
        ...requiredBase,
        actionConfig: {},
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('rejects when startDate is missing', () => {
      const { startDate: _removed, ...input } = requiredBase as typeof requiredBase & {
        startDate?: string
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('startDate'))).toBe(true)
    })

    it('rejects a non-ISO-8601 string for startDate', () => {
      const input = { ...requiredBase, startDate: 'not-a-date' }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('startDate'))).toBe(true)
    })

    it('rejects a negative budgetCap', () => {
      const input = { ...requiredBase, budgetCap: -100 }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('budgetCap'))).toBe(true)
    })

    it('rejects a zero budgetCap', () => {
      const input = { ...requiredBase, budgetCap: 0 }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('budgetCap'))).toBe(true)
    })

    it('rejects a string value for budgetCap', () => {
      const input = { ...requiredBase, budgetCap: 'a-lot' }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('budgetCap'))).toBe(true)
    })

    it('rejects when programId is missing', () => {
      const { programId: _removed, ...input } = requiredBase as typeof requiredBase & {
        programId?: string
      }

      const result = CreateCampaignSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('programId'))).toBe(true)
    })
  })

  describe('spin_wheel action type', () => {
    const validSpinWheelConfig = {
      segments: [
        { points: 500, probability: 40, label: '500 Points!', color: '#4F46E5' },
        { rewardId: 'rwd-001', probability: 15, label: 'Free Coffee', color: '#10B981' },
        { points: 100, probability: 25, label: '10% Off', color: '#F59E0B' },
        { points: 50, probability: 20, label: '50 Points', color: '#EF4444' },
      ],
      wheelStyle: 'classic' as const,
    }

    const spinWheelBase = {
      name: 'Holiday Spin & Win',
      programId: 'prog-abc-123',
      triggerType: 'purchase',
      actionType: 'spin_wheel' as const,
      actionConfig: validSpinWheelConfig,
      startDate: '2026-04-15T00:00:00.000Z',
    }

    it('accepts a valid spin_wheel campaign', () => {
      const result = CreateCampaignSchema.safeParse(spinWheelBase)
      expect(result.success).toBe(true)
    })

    it('accepts spin_wheel with 2 segments (minimum)', () => {
      const input = {
        ...spinWheelBase,
        actionConfig: {
          segments: [
            { points: 60, probability: 60, label: 'Small', color: '#4F46E5' },
            { points: 200, probability: 40, label: 'Big', color: '#10B981' },
          ],
        },
      }
      const result = CreateCampaignSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('accepts spin_wheel with 8 segments (maximum)', () => {
      const segments = Array.from({ length: 8 }, (_, i) => ({
        points: 100,
        probability: 12.5,
        label: `Seg ${i + 1}`,
        color: `#${(i * 2 + 1).toString(16).padStart(2, '0')}46E5`,
      }))
      const input = {
        ...spinWheelBase,
        actionConfig: { segments },
      }
      const result = CreateCampaignSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects spin_wheel with 1 segment (below minimum)', () => {
      const input = {
        ...spinWheelBase,
        actionConfig: {
          segments: [{ points: 100, probability: 100, label: 'Only', color: '#4F46E5' }],
        },
      }
      const result = CreateCampaignSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects spin_wheel with 9 segments (above maximum)', () => {
      const segments = Array.from({ length: 9 }, (_, i) => ({
        points: 100,
        probability: 100 / 9,
        label: `Seg ${i}`,
        color: '#4F46E5',
      }))
      const input = {
        ...spinWheelBase,
        actionConfig: { segments },
      }
      const result = CreateCampaignSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects when probabilities do not sum to 100%', () => {
      const input = {
        ...spinWheelBase,
        actionConfig: {
          segments: [
            { points: 100, probability: 40, label: 'A', color: '#4F46E5' },
            { points: 200, probability: 40, label: 'B', color: '#10B981' },
          ],
        },
      }
      const result = CreateCampaignSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects a segment with invalid hex color', () => {
      const result = SpinWheelSegmentSchema.safeParse({
        points: 100,
        probability: 50,
        label: 'Test',
        color: 'red',
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues.some((i) => i.path.includes('color'))).toBe(true)
    })

    it('rejects a segment with neither rewardId nor points', () => {
      const result = SpinWheelSegmentSchema.safeParse({
        probability: 50,
        label: 'Test',
        color: '#4F46E5',
      })
      expect(result.success).toBe(false)
    })

    it('accepts a segment with 0 probability (visual-only segment)', () => {
      const result = SpinWheelSegmentSchema.safeParse({
        points: 1000,
        probability: 0,
        label: 'Jackpot',
        color: '#FFD700',
      })
      expect(result.success).toBe(true)
    })

    it('rejects a segment with empty label', () => {
      const result = SpinWheelSegmentSchema.safeParse({
        points: 100,
        probability: 50,
        label: '',
        color: '#4F46E5',
      })
      expect(result.success).toBe(false)
    })

    it('accepts SpinWheelConfigSchema with default wheelStyle', () => {
      const config = {
        segments: [
          { points: 50, probability: 50, label: 'A', color: '#4F46E5' },
          { points: 100, probability: 50, label: 'B', color: '#10B981' },
        ],
      }
      const result = SpinWheelConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.wheelStyle).toBe('classic')
      }
    })
  })
})
