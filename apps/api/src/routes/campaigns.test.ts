/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateCampaignSchema, UpdateCampaignStatusSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Campaign schema validation — ensures schemas correctly validate/reject
// payloads before they reach the route handlers.
// ---------------------------------------------------------------------------

describe('Campaign schema validation', () => {
  describe('CreateCampaignSchema', () => {
    const valid = {
      name: 'Double Points Weekend',
      programId: 'prog-001',
      triggerType: 'event_based',
      actionType: 'award_points' as const,
      actionConfig: { points: 200 },
      startDate: new Date().toISOString(),
    }

    it('accepts a valid campaign payload', () => {
      expect(CreateCampaignSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects missing name', () => {
      const { name: _, ...noName } = valid
      expect(CreateCampaignSchema.safeParse(noName).success).toBe(false)
    })

    it('rejects missing programId', () => {
      const { programId: _, ...noProgramId } = valid
      expect(CreateCampaignSchema.safeParse(noProgramId).success).toBe(false)
    })

    it('accepts spin_wheel actionType with valid config', () => {
      const spinWheel = {
        ...valid,
        actionType: 'spin_wheel' as const,
        actionConfig: {
          segments: [
            { label: 'Win 100pts', probability: 50, points: 100, color: '#4F46E5' },
            { label: 'Try Again', probability: 50, points: 1, color: '#EF4444' },
          ],
          wheelStyle: 'classic',
        },
      }
      expect(CreateCampaignSchema.safeParse(spinWheel).success).toBe(true)
    })

    it('accepts scratch_card actionType with valid config', () => {
      const scratchCard = {
        ...valid,
        actionType: 'scratch_card' as const,
        actionConfig: {
          prizes: [
            { label: 'Win!', probability: 30, points: 50 },
            { label: 'Lose', probability: 70, points: 1 },
          ],
          cardStyle: 'gold',
        },
      }
      expect(CreateCampaignSchema.safeParse(scratchCard).success).toBe(true)
    })

    it('accepts mystery_box actionType with valid config', () => {
      const mysteryBox = {
        ...valid,
        actionType: 'mystery_box' as const,
        actionConfig: {
          prizes: [
            { label: 'Gold Box', probability: 20, points: 500 },
            { label: 'Silver Box', probability: 80, points: 100 },
          ],
          boxStyle: 'gift',
        },
      }
      expect(CreateCampaignSchema.safeParse(mysteryBox).success).toBe(true)
    })

    it('rejects spin_wheel when probabilities do not sum to 100', () => {
      const bad = {
        ...valid,
        actionType: 'spin_wheel' as const,
        actionConfig: {
          segments: [
            { label: 'Win', probability: 30, points: 100, color: '#4F46E5' },
            { label: 'Lose', probability: 30, points: 1, color: '#EF4444' },
          ],
        },
      }
      expect(CreateCampaignSchema.safeParse(bad).success).toBe(false)
    })
  })

  describe('UpdateCampaignStatusSchema', () => {
    it('accepts ACTIVE', () => {
      expect(UpdateCampaignStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
    })

    it('accepts PAUSED', () => {
      expect(UpdateCampaignStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true)
    })

    it('accepts COMPLETED', () => {
      expect(UpdateCampaignStatusSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true)
    })

    it('rejects invalid status', () => {
      expect(UpdateCampaignStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false)
    })

    it('rejects missing status', () => {
      expect(UpdateCampaignStatusSchema.safeParse({}).success).toBe(false)
    })
  })
})
