// Issue #241 Slice 4a — pure skip-rule evaluator for the survey renderer.
// Operator semantics match the SkipConditionSchema in @customerEQ/shared.

import type { SkipRule, SkipCondition, SurveyQuestion } from '@customerEQ/shared'

import type { AnswersState } from './types'

function evaluateCondition(condition: SkipCondition, answers: AnswersState): boolean {
  const answer = answers[condition.sourceQuestionId]
  const ruleValue = condition.value as unknown

  switch (condition.operator) {
    case 'eq':
      return answer === ruleValue
    case 'ne':
      return answer !== ruleValue
    case 'lt':
      return typeof answer === 'number' && typeof ruleValue === 'number' && answer < ruleValue
    case 'lte':
      return typeof answer === 'number' && typeof ruleValue === 'number' && answer <= ruleValue
    case 'gt':
      return typeof answer === 'number' && typeof ruleValue === 'number' && answer > ruleValue
    case 'gte':
      return typeof answer === 'number' && typeof ruleValue === 'number' && answer >= ruleValue
    case 'contains':
      return typeof answer === 'string' && typeof ruleValue === 'string' && answer.includes(ruleValue)
    case 'not_contains':
      return !(typeof answer === 'string' && typeof ruleValue === 'string' && answer.includes(ruleValue))
    case 'is_empty':
      return answer === null || answer === undefined || answer === ''
    case 'is_not_empty':
      return !(answer === null || answer === undefined || answer === '')
    default:
      return false
  }
}

function evaluateRule(rule: SkipRule, answers: AnswersState): boolean {
  const results = rule.conditions.map((c) => evaluateCondition(c, answers))
  return rule.conditionLogic === 'OR' ? results.some(Boolean) : results.every(Boolean)
}

export function shouldShowQuestion(question: SurveyQuestion, answers: AnswersState): boolean {
  const rules = question.skipRules ?? []
  if (rules.length === 0) return true

  // Multiple rules: each rule independently can hide or force-show; first
  // firing rule wins. In V0 the canvas only emits a single rule per target
  // (the editor only lets the operator define one); future flows can revisit.
  for (const rule of rules) {
    if (!evaluateRule(rule, answers)) continue
    if (rule.action === 'hide') return false
    if (rule.action === 'show') return true
  }
  // No rule fired. If any rule is action='show' but did not match, the
  // question is hidden by default. If all rules are action='hide' and none
  // fired, the question shows.
  const hasUnfiredShow = rules.some((r) => r.action === 'show')
  return !hasUnfiredShow
}
