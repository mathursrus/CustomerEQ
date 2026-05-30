import type { SurveyQuestion } from './zod/survey.schema.js'

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

export function freshPresetFor(nextType: SurveyType): SurveyQuestion[] {
  const preset = presetFor(nextType)
  return preset.map((q) => ({
    ...q,
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
  }))
}
