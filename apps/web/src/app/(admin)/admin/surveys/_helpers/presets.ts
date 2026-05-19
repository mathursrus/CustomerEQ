// Issue #241 Slice 4b (#336) — Shared survey-type question presets.
//
// Source of truth for NPS / CSAT / CES preset shapes. Used by:
//   - /admin/surveys/new (initial questions on draft creation)
//   - /admin/surveys/[id]/edit BasicsTab (type-change auto-swap)
//
// Per RFC §"Primary score field resolution": the standard rating question
// in each preset carries isScoreField=true so the survey-response handler
// can lift its value into SurveyResponse.score without operator action.
// Per spec line 576 of docs/feature-specs/mocks/241-survey-admin-ux.html:
// "Picking NPS / CSAT / CES auto-populates the Questions tab with the
// standard set (all editable). Custom = blank canvas."

import type { SurveyQuestion } from '@customerEQ/shared'

export type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

export const PRESET_QUESTIONS_NPS: SurveyQuestion[] = [
  {
    id: 'q_nps_score',
    type: 'rating',
    text: 'How likely are you to recommend us to a friend or colleague?',
    required: true,
    config: { min: 0, max: 10, labels: { left: 'Not at all likely', right: 'Extremely likely' } },
    isScoreField: true,
  },
  {
    id: 'q_nps_reason',
    type: 'text',
    text: 'What is the primary reason for your score?',
    required: false,
    config: { multiline: true, maxLength: 500 },
  },
]

export const PRESET_QUESTIONS_CSAT: SurveyQuestion[] = [
  {
    id: 'q_csat_score',
    type: 'rating',
    text: 'How satisfied are you with your experience?',
    required: true,
    config: { min: 1, max: 5, labels: { left: 'Very dissatisfied', right: 'Very satisfied' } },
    isScoreField: true,
  },
  {
    id: 'q_csat_reason',
    type: 'text',
    text: 'What is the primary reason for your rating?',
    required: false,
    config: { multiline: true, maxLength: 500 },
  },
]

export const PRESET_QUESTIONS_CES: SurveyQuestion[] = [
  {
    id: 'q_ces_score',
    type: 'rating',
    text: 'How easy was it to get what you needed?',
    required: true,
    config: { min: 1, max: 7, labels: { left: 'Very difficult', right: 'Very easy' } },
    isScoreField: true,
  },
  {
    id: 'q_ces_reason',
    type: 'text',
    text: 'What made it difficult or easy?',
    required: false,
    config: { multiline: true, maxLength: 500 },
  },
]

export function presetFor(type: SurveyType): SurveyQuestion[] {
  switch (type) {
    case 'NPS':
      return PRESET_QUESTIONS_NPS
    case 'CSAT':
      return PRESET_QUESTIONS_CSAT
    case 'CES':
      return PRESET_QUESTIONS_CES
    case 'CUSTOM':
      return []
  }
}

/**
 * Returns true if the survey's current questions match the standard preset
 * for `currentType` exactly. Used by the type-change flow to decide whether
 * to swap presets silently (user hasn't customized) or surface the modal
 * (operator edits would be lost).
 *
 * Compares on (type, text) per index — id is not stable across remounts/loads
 * so it is intentionally ignored. config is ignored too so an operator who
 * tweaked the rating scale or label still gets the modal warning.
 */
export function isUnchangedPreset(
  questions: SurveyQuestion[] | undefined,
  currentType: SurveyType,
): boolean {
  if (currentType === 'CUSTOM') return (questions?.length ?? 0) === 0
  const preset = presetFor(currentType)
  if ((questions?.length ?? 0) !== preset.length) return false
  return (questions ?? []).every(
    (q, i) => q.type === preset[i].type && q.text === preset[i].text,
  )
}

/**
 * Returns a fresh preset for `nextType` with new randomized ids so the
 * inserted questions cannot collide with whatever was on the survey before.
 * For CUSTOM, returns []. The standard rating question is marked
 * isScoreField=true per RFC §"Primary score field resolution".
 */
export function freshPresetFor(nextType: SurveyType): SurveyQuestion[] {
  const preset = presetFor(nextType)
  return preset.map((q) => ({
    ...q,
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
  }))
}
