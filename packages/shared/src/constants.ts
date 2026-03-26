export const SENTIMENT = {
  POSITIVE_THRESHOLD: 0.3,
  NEGATIVE_THRESHOLD: -0.3,
  classify(value: number): 'positive' | 'neutral' | 'negative' {
    if (value > 0.3) return 'positive'
    if (value < -0.3) return 'negative'
    return 'neutral'
  },
} as const

export const NPS = {
  PROMOTER_THRESHOLD: 9,
  DETRACTOR_THRESHOLD: 6,
  isPromoter(score: number): boolean { return score >= 9 },
  isDetractor(score: number): boolean { return score <= 6 },
} as const
