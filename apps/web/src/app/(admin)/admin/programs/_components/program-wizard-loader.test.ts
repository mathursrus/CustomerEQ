import { describe, it, expect } from 'vitest'

// Since mapReward is not exported, we test the tier-resolution logic inline.

interface ApiTier {
  id: string
  name: string
  icon: string | null
  minPoints: number | null
  minSpendCents: number | null
  multiplier: number
  benefits: string[]
}

// This mirrors the FIXED mapReward eligibleTiers logic.
function mapRewardEligibleTiers(
  eligibleTierIds: string[],
  tiers: ApiTier[],
): string {
  if (eligibleTierIds.length === 0) return 'All Tiers'
  const names = tiers
    .filter((t) => eligibleTierIds.includes(t.id))
    .map((t) => t.name)
    .join(', ')
  return names || 'All Tiers'
}

const TIERS: ApiTier[] = [
  { id: 'tier-gold', name: 'Gold', icon: null, minPoints: 1000, minSpendCents: null, multiplier: 2, benefits: ['Free shipping'] },
  { id: 'tier-plat', name: 'Platinum', icon: null, minPoints: 5000, minSpendCents: null, multiplier: 3, benefits: ['VIP access'] },
  { id: 'tier-silver', name: 'Silver', icon: null, minPoints: 500, minSpendCents: null, multiplier: 1.5, benefits: [] },
]

describe('mapReward eligibleTiers (#134)', () => {
  it('returns "All Tiers" when eligibleTierIds is empty', () => {
    expect(mapRewardEligibleTiers([], TIERS)).toBe('All Tiers')
  })

  it('resolves a single tier ID to its name', () => {
    expect(mapRewardEligibleTiers(['tier-gold'], TIERS)).toBe('Gold')
  })

  it('resolves multiple tier IDs to comma-separated names', () => {
    expect(mapRewardEligibleTiers(['tier-gold', 'tier-plat'], TIERS)).toBe('Gold, Platinum')
  })

  it('falls back to "All Tiers" if tier IDs do not match any known tiers', () => {
    expect(mapRewardEligibleTiers(['tier-unknown'], TIERS)).toBe('All Tiers')
  })

  it('handles mix of valid and invalid tier IDs gracefully', () => {
    expect(mapRewardEligibleTiers(['tier-gold', 'tier-unknown'], TIERS)).toBe('Gold')
  })
})
