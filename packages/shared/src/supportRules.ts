/**
 * Support rule evaluation logic.
 * Evaluates SupportRules against conversation context (intent, tier, health score, topics).
 * Rules are evaluated in priority order (lower priority number = evaluated first).
 * All matching rules fire (not first-match-wins).
 */

import { evaluateConditions, type ConditionGroup } from './conditions.js'

export interface SupportRuleContext {
  intent: string
  tier?: string
  healthScore?: number
  topics: string[]
}

export interface SupportRuleInput {
  id: string
  intentFilters: string[]
  tierFilters: string[]
  healthScoreMin: number | null
  healthScoreMax: number | null
  topicFilters: string[]
  conditions: unknown // JSON — ConditionGroup
  autoRespondArticleId: string | null
  escalateToAssignee: string | null
  awardPoints: number | null
  triggerSurveyId: string | null
}

export interface SupportRuleMatchResult {
  rules: SupportRuleInput[]
  ruleIds: string[]
  shouldEscalate: boolean
  escalateToAssignee: string | null
  autoResponseContent: string | null
}

export function evaluateSupportRules(
  rules: SupportRuleInput[],
  context: SupportRuleContext,
): SupportRuleMatchResult {
  const matched: SupportRuleInput[] = []

  for (const rule of rules) {
    // Intent filter: empty = match all
    if (rule.intentFilters.length > 0 && !rule.intentFilters.includes(context.intent)) continue
    // Tier filter: empty = match all; skip if tier is not provided
    if (rule.tierFilters.length > 0 && context.tier && !rule.tierFilters.includes(context.tier)) continue
    // If tier filters are set but no tier in context, skip this rule
    if (rule.tierFilters.length > 0 && !context.tier) continue
    // Health score range
    if (rule.healthScoreMin !== null && context.healthScore !== undefined && context.healthScore < rule.healthScoreMin) continue
    if (rule.healthScoreMax !== null && context.healthScore !== undefined && context.healthScore > rule.healthScoreMax) continue
    // If health score filters are set but no health score in context, skip
    if ((rule.healthScoreMin !== null || rule.healthScoreMax !== null) && context.healthScore === undefined) continue
    // Topic filter: empty = match all
    if (rule.topicFilters.length > 0 && !rule.topicFilters.some(
      (t) => context.topics.some((ct) => ct.toLowerCase().includes(t.toLowerCase())),
    )) continue
    // Additional conditions (ConditionGroup)
    if (rule.conditions && typeof rule.conditions === 'object' && Object.keys(rule.conditions as object).length > 0) {
      if (!evaluateConditions(rule.conditions as ConditionGroup, context as unknown as Record<string, unknown>)) continue
    }

    matched.push(rule)
  }

  return {
    rules: matched,
    ruleIds: matched.map((r) => r.id),
    shouldEscalate: matched.some((r) => r.escalateToAssignee != null),
    escalateToAssignee: matched.find((r) => r.escalateToAssignee)?.escalateToAssignee ?? null,
    autoResponseContent: matched.find((r) => r.autoRespondArticleId)?.autoRespondArticleId ?? null,
  }
}
