export interface HealthScoreComputationPayload {
  brandId: string
  memberId?: string // if provided, recompute only this member; otherwise all active members
}

export interface HealthScoreWeights {
  recency: number // default 0.25
  frequency: number // default 0.20
  sentiment: number // default 0.25
  nps: number // default 0.15
  engagement: number // default 0.15
}

export interface HealthScoreBreakdown {
  recency: number
  frequency: number
  sentiment: number
  nps: number
  engagement: number
  overall: number
  computedAt: string // ISO 8601
}

export const DEFAULT_HEALTH_SCORE_WEIGHTS: HealthScoreWeights = {
  recency: 0.25,
  frequency: 0.20,
  sentiment: 0.25,
  nps: 0.15,
  engagement: 0.15,
}
