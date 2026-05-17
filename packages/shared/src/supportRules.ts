import type { SupportActionMode } from './zod/support.schema.js'

export interface SupportRuleInput {
  id: string
  status: 'ACTIVE' | 'INACTIVE'
  priority: number
  intentFilters: string[]
  tierFilters: string[]
  healthScoreMin: number | null
  healthScoreMax: number | null
  topicFilters: string[]
  conditions: Record<string, unknown>
  actionMode: SupportActionMode
  confidenceThreshold: number
  autoRespondArticleId: string | null
  escalateToAssignee: string | null
  awardPoints: number | null
  triggerSurveyId: string | null
}

export interface SupportRuleMatch {
  ruleId: string
  actionMode: SupportActionMode
  confidenceThreshold: number
  autoRespondArticleId: string | null
  escalateToAssignee: string | null
  awardPoints: number | null
  triggerSurveyId: string | null
}

export interface SupportRuleMatchResult {
  matchedRules: SupportRuleMatch[]
  ruleIds: string[]
  shouldEscalate: boolean
  escalateToAssignee: string | null
  autoResponseArticleId: string | null
}

export interface SupportRuleContext {
  intent: string
  tier: string | null
  healthScore: number | undefined
  topics: string[]
}

export function evaluateSupportRules(
  rules: SupportRuleInput[],
  context: SupportRuleContext,
): SupportRuleMatchResult {
  const active = rules.filter((r) => r.status === 'ACTIVE')
  const sorted = [...active].sort((a, b) => a.priority - b.priority)

  const matches: SupportRuleMatch[] = []
  for (const rule of sorted) {
    if (rule.intentFilters.length && !rule.intentFilters.includes(context.intent)) continue
    if (rule.tierFilters.length && (!context.tier || !rule.tierFilters.includes(context.tier))) continue
    if (rule.healthScoreMin != null && (context.healthScore == null || context.healthScore < rule.healthScoreMin)) continue
    if (rule.healthScoreMax != null && (context.healthScore == null || context.healthScore > rule.healthScoreMax)) continue
    if (rule.topicFilters.length && !rule.topicFilters.some((t) => context.topics.includes(t))) continue

    matches.push({
      ruleId: rule.id,
      actionMode: rule.actionMode,
      confidenceThreshold: rule.confidenceThreshold,
      autoRespondArticleId: rule.autoRespondArticleId,
      escalateToAssignee: rule.escalateToAssignee,
      awardPoints: rule.awardPoints,
      triggerSurveyId: rule.triggerSurveyId,
    })
  }

  const shouldEscalate = matches.some((m) => m.actionMode === 'ESCALATE')
  const escalateRule = matches.find((m) => m.actionMode === 'ESCALATE')
  const autoReplyRule = matches.find((m) => m.actionMode === 'AUTO_REPLY' && m.autoRespondArticleId)

  return {
    matchedRules: matches,
    ruleIds: matches.map((m) => m.ruleId),
    shouldEscalate,
    escalateToAssignee: escalateRule?.escalateToAssignee ?? null,
    autoResponseArticleId: autoReplyRule?.autoRespondArticleId ?? null,
  }
}
