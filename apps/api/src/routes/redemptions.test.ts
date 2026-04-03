/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { RedeemSchema } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Redemption schema validation — the atomic redemption flow with transaction,
// stock checks, and points deduction is tested via integration tests.
// ---------------------------------------------------------------------------

describe('Redemption schema validation', () => {
  describe('RedeemSchema', () => {
    const valid = {
      memberId: 'member-001',
      rewardId: 'reward-001',
    }

    it('accepts a valid redemption payload', () => {
      expect(RedeemSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects missing memberId', () => {
      expect(RedeemSchema.safeParse({ rewardId: 'reward-001' }).success).toBe(false)
    })

    it('rejects missing rewardId', () => {
      expect(RedeemSchema.safeParse({ memberId: 'member-001' }).success).toBe(false)
    })

    it('rejects empty memberId', () => {
      expect(RedeemSchema.safeParse({ memberId: '', rewardId: 'reward-001' }).success).toBe(false)
    })
  })
})
