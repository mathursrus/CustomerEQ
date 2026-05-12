import { describe, it, expect } from 'vitest'
import { shouldShowQuestion } from './skip-rules.logic'
import type { SurveyQuestion } from '@customerEQ/shared'

// Issue #241 Slice 4a — skip-rule evaluation for SurveyFormRenderer.
// Tests every operator + show/hide action + AND/OR composition.

const baseQuestion: SurveyQuestion = {
  id: 'q_target',
  type: 'text',
  text: 'Why?',
  required: false,
  config: {},
}

function questionWithRule(action: 'show' | 'hide', conditions: any[], conditionLogic: 'AND' | 'OR' = 'AND'): SurveyQuestion {
  return {
    ...baseQuestion,
    skipRules: [{ targetQuestionId: 'q_target', action, conditions, conditionLogic }],
  }
}

describe('shouldShowQuestion', () => {
  describe('no skip rules', () => {
    it('returns true when the question has no skipRules at all', () => {
      expect(shouldShowQuestion(baseQuestion, {})).toBe(true)
    })

    it('returns true when skipRules is an empty array', () => {
      expect(shouldShowQuestion({ ...baseQuestion, skipRules: [] }, {})).toBe(true)
    })
  })

  describe('operators', () => {
    it.each([
      ['eq', 5, 5, true],
      ['eq', 5, 4, false],
      ['ne', 5, 4, true],
      ['ne', 5, 5, false],
      ['lt', 5, 4, true],
      ['lt', 5, 5, false],
      ['lte', 5, 5, true],
      ['lte', 5, 6, false],
      ['gt', 5, 6, true],
      ['gt', 5, 5, false],
      ['gte', 5, 5, true],
      ['gte', 5, 4, false],
    ] as const)('action=hide · operator=%s · ruleValue=%s · answer=%s → condition matches=%s', (operator, ruleValue, answer, conditionMatches) => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator, value: ruleValue }])
      // When action=hide and the condition matches, the question is hidden → shouldShow=false
      expect(shouldShowQuestion(q, { q_src: answer })).toBe(!conditionMatches)
    })

    it('contains: substring match in string answer', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'contains', value: 'foo' }])
      expect(shouldShowQuestion(q, { q_src: 'foobar' })).toBe(false)
      expect(shouldShowQuestion(q, { q_src: 'bar' })).toBe(true)
    })

    it('not_contains: inverse of contains', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'not_contains', value: 'foo' }])
      expect(shouldShowQuestion(q, { q_src: 'bar' })).toBe(false)
      expect(shouldShowQuestion(q, { q_src: 'foobar' })).toBe(true)
    })

    it('is_empty: matches null / undefined / empty string', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'is_empty' }])
      expect(shouldShowQuestion(q, { q_src: null })).toBe(false)
      expect(shouldShowQuestion(q, { q_src: '' })).toBe(false)
      expect(shouldShowQuestion(q, { q_src: 'set' })).toBe(true)
    })

    it('is_not_empty: inverse of is_empty', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'is_not_empty' }])
      expect(shouldShowQuestion(q, { q_src: 'set' })).toBe(false)
      expect(shouldShowQuestion(q, { q_src: null })).toBe(true)
    })
  })

  describe('show vs hide action', () => {
    it('action=show, condition matches → show', () => {
      const q = questionWithRule('show', [{ sourceQuestionId: 'q_src', operator: 'eq', value: 'yes' }])
      expect(shouldShowQuestion(q, { q_src: 'yes' })).toBe(true)
    })

    it('action=show, condition does not match → hide', () => {
      const q = questionWithRule('show', [{ sourceQuestionId: 'q_src', operator: 'eq', value: 'yes' }])
      expect(shouldShowQuestion(q, { q_src: 'no' })).toBe(false)
    })

    it('action=hide, condition matches → hide', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'eq', value: 'yes' }])
      expect(shouldShowQuestion(q, { q_src: 'yes' })).toBe(false)
    })

    it('action=hide, condition does not match → show', () => {
      const q = questionWithRule('hide', [{ sourceQuestionId: 'q_src', operator: 'eq', value: 'yes' }])
      expect(shouldShowQuestion(q, { q_src: 'no' })).toBe(true)
    })
  })

  describe('AND / OR composition', () => {
    it('AND: all conditions must match for the rule to fire', () => {
      const q = questionWithRule(
        'hide',
        [
          { sourceQuestionId: 'q_a', operator: 'eq', value: 1 },
          { sourceQuestionId: 'q_b', operator: 'eq', value: 2 },
        ],
        'AND',
      )
      expect(shouldShowQuestion(q, { q_a: 1, q_b: 2 })).toBe(false) // both match → hidden
      expect(shouldShowQuestion(q, { q_a: 1, q_b: 99 })).toBe(true) // partial match → not hidden
    })

    it('OR: any condition matching fires the rule', () => {
      const q = questionWithRule(
        'hide',
        [
          { sourceQuestionId: 'q_a', operator: 'eq', value: 1 },
          { sourceQuestionId: 'q_b', operator: 'eq', value: 2 },
        ],
        'OR',
      )
      expect(shouldShowQuestion(q, { q_a: 1, q_b: 99 })).toBe(false) // one matches → hidden
      expect(shouldShowQuestion(q, { q_a: 0, q_b: 0 })).toBe(true) // none match → not hidden
    })
  })
})
