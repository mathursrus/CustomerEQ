import { randomInt } from 'node:crypto'

export interface WeightedItem {
  probability: number
}

/**
 * Selects a random item from a weighted list using crypto-secure randomness.
 * Probabilities should sum to 100 (percent).
 */
export function selectWeightedRandom<T extends WeightedItem>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot select from empty items array')
  }
  if (items.length === 1) {
    return items[0]
  }

  // Scale probabilities to integers (×100) for crypto.randomInt integer range
  const totalWeight = Math.round(
    items.reduce((sum, item) => sum + item.probability * 100, 0),
  )

  if (totalWeight <= 0) {
    throw new Error('Total probability weight must be positive')
  }

  const roll = randomInt(0, totalWeight) // [0, totalWeight)

  let cumulative = 0
  for (const item of items) {
    cumulative += Math.round(item.probability * 100)
    if (roll < cumulative) return item
  }

  // Fallback for floating-point rounding edge case
  return items[items.length - 1]
}
