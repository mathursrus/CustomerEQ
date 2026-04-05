import type { Insight } from '@customerEQ/shared'

export interface InsightInputs {
  atRiskCount: number
  activeSurveys: number
  responseRate: number
  surveyCompletersMultiplier: number | null
  surveyCompletersMemberCount: number
}

const MAX_INSIGHTS = 3

export function computeInsights(inputs: InsightInputs): Insight[] {
  const insights: Insight[] = []

  // Rule 1: detractors-no-redemption
  // Fires when atRiskCount >= 5 (statistically significant threshold)
  if (inputs.atRiskCount >= 5) {
    insights.push({
      id: 'detractors-no-redemption',
      message: `${inputs.atRiskCount} detractors (NPS < 7) have not redeemed a reward in 30 days`,
      ctaLabel: 'Create win-back campaign',
      ctaHref: '/admin/campaigns/new?filter=detractors&maxNps=6',
      severity: 'warning',
    })
  }

  if (insights.length >= MAX_INSIGHTS) return insights

  // Rule 2: survey-completers-earn-more
  // Fires when multiplier >= 1.5 and based on >= 10 members (statistically significant)
  if (
    inputs.surveyCompletersMultiplier !== null &&
    inputs.surveyCompletersMultiplier >= 1.5 &&
    inputs.surveyCompletersMemberCount >= 10
  ) {
    const multiplier = inputs.surveyCompletersMultiplier.toFixed(1)
    insights.push({
      id: 'survey-completers-earn-more',
      message: `Members who completed a survey earned ${multiplier}× more points this month`,
      ctaLabel: 'Create survey',
      ctaHref: '/admin/surveys/new',
      severity: 'info',
    })
  }

  if (insights.length >= MAX_INSIGHTS) return insights

  // Rule 3: low-response-rate
  // Fires when responseRate < 20% AND there are active surveys (to avoid noise)
  if (inputs.responseRate < 20 && inputs.activeSurveys > 0) {
    const rate = Math.round(inputs.responseRate)
    insights.push({
      id: 'low-response-rate',
      message: `Your survey response rate is ${rate}% — consider adding a reward incentive`,
      ctaLabel: 'Add reward',
      ctaHref: '/admin/rewards/new',
      severity: 'warning',
    })
  }

  return insights
}
