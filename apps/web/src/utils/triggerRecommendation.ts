export interface TriggerRecommendation {
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  rationale: string
  isDefault: boolean
}

const MAP: Record<string, TriggerRecommendation> = {
  tier_upgrade: {
    type: 'CSAT',
    rationale: 'Tier upgrades are milestone moments — CSAT captures immediate satisfaction with the achievement.',
    isDefault: false,
  },
  first_redemption: {
    type: 'CSAT',
    rationale: 'First redemption marks the first value exchange — CSAT captures satisfaction with the reward experience.',
    isDefault: false,
  },
  '5th_purchase': {
    type: 'CSAT',
    rationale: 'Multiple purchases signal loyalty — CSAT validates the product experience is driving repeat behaviour.',
    isDefault: false,
  },
  enrollment: {
    type: 'CES',
    rationale: 'Enrollment is a process — CES measures how easy it was to join, surfacing friction early.',
    isDefault: false,
  },
  anniversary: {
    type: 'NPS',
    rationale: 'Anniversaries are relationship checkpoints — NPS captures long-term loyalty sentiment.',
    isDefault: false,
  },
  inactive_30d: {
    type: 'NPS',
    rationale: 'Win-back moments need to understand overall relationship health — NPS identifies promoters vs detractors for recovery campaigns.',
    isDefault: false,
  },
  after_support: {
    type: 'CES',
    rationale: 'Post-support is about effort — CES directly measures resolution ease and drives service improvement.',
    isDefault: false,
  },
  nps_drop: {
    type: 'NPS',
    rationale: 'NPS drops require re-measurement to confirm recovery or escalate — NPS tracks the recovery arc.',
    isDefault: false,
  },
  quarterly_pulse: {
    type: 'NPS',
    rationale: 'Quarterly pulses are strategic check-ins — NPS benchmarks overall loyalty health over time.',
    isDefault: false,
  },
  monthly_csat: {
    type: 'CSAT',
    rationale: 'Monthly cadence targets ongoing satisfaction — CSAT tracks operational consistency.',
    isDefault: false,
  },
  annual_program: {
    type: 'NPS',
    rationale: 'Annual program reviews need strategic insight — NPS captures the full loyalty relationship.',
    isDefault: false,
  },
}

const FALLBACK: TriggerRecommendation = {
  type: 'NPS',
  rationale: 'NPS is the standard baseline for measuring overall loyalty health when no specific trigger context is available.',
  isDefault: true,
}

export function getTriggerRecommendation(triggerKey: string): TriggerRecommendation {
  return MAP[triggerKey] ?? FALLBACK
}
