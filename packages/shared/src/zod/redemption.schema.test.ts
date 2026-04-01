/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { RedeemSchema } from './redemption.schema.js'

describe('RedeemSchema', () => {
  const valid = {
    rewardId: 'reward_abc123',
    memberId: 'member_xyz789',
  }

  it('accepts valid input', () => {
    const result = RedeemSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects missing rewardId', () => {
    const result = RedeemSchema.safeParse({ memberId: 'member_xyz789' })
    expect(result.success).toBe(false)
  })

  it('rejects missing memberId', () => {
    const result = RedeemSchema.safeParse({ rewardId: 'reward_abc123' })
    expect(result.success).toBe(false)
  })

  it('rejects empty rewardId string', () => {
    const result = RedeemSchema.safeParse({ rewardId: '', memberId: 'member_xyz789' })
    expect(result.success).toBe(false)
  })

  it('rejects empty memberId string', () => {
    const result = RedeemSchema.safeParse({ rewardId: 'reward_abc123', memberId: '' })
    expect(result.success).toBe(false)
  })
})
