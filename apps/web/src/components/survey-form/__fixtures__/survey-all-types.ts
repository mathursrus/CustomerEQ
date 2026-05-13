// Issue #241 Slice 4a — survey fixture exercising every QuestionType plus a
// representative skip rule. Drives SurveyFormRenderer + page-level snapshot
// tests. Keeps the test surface stable as new types land (extend this fixture
// when QUESTION_TYPES grows).

import type { SurveyQuestion } from '@customerEQ/shared'

export const QUESTIONS_ALL_TYPES: SurveyQuestion[] = [
  {
    id: 'q_rating',
    type: 'rating',
    text: 'How likely are you to recommend us?',
    required: true,
    config: { min: 0, max: 10 },
  },
  {
    id: 'q_text',
    type: 'text',
    text: 'Tell us why you gave that score.',
    required: false,
    config: { multiline: true, maxLength: 500, placeholder: 'Your thoughts…' },
  },
  {
    id: 'q_choice',
    type: 'choice',
    text: 'Pick the best option.',
    required: true,
    options: ['Excellent', 'Good', 'Fair', 'Poor'],
    config: {},
  },
  {
    id: 'q_mc',
    type: 'multiple_choice',
    text: 'Which channel did you use?',
    required: true,
    config: { options: ['Web', 'Mobile app', 'Phone'], allowOther: true },
  },
  {
    id: 'q_cb',
    type: 'checkbox',
    text: 'Which features do you use? (select all that apply)',
    required: false,
    config: { options: ['Search', 'Bookmarks', 'Sharing', 'Notifications'], minSelect: 0, maxSelect: 4 },
  },
  {
    id: 'q_dd',
    type: 'dropdown',
    text: 'Where did you hear about us?',
    required: false,
    config: { options: ['Friend', 'Search engine', 'Social media', 'Other'] },
  },
  {
    id: 'q_mtx',
    type: 'matrix',
    text: 'Rate each aspect of our service.',
    required: false,
    config: {
      rows: ['Speed', 'Quality', 'Support'],
      columns: ['1', '2', '3', '4', '5'],
    },
  },
  {
    id: 'q_rnk',
    type: 'ranking',
    text: 'Rank these features from most to least important.',
    required: false,
    config: { options: ['Price', 'Speed', 'Quality', 'Support'] },
  },
  {
    id: 'q_slider',
    type: 'slider',
    text: 'How satisfied are you overall?',
    required: true,
    config: {
      min: 0,
      max: 100,
      step: 1,
      labels: { left: 'Not at all', right: 'Extremely' },
    },
  },
  {
    id: 'q_likert',
    type: 'likert',
    text: 'Please indicate your agreement.',
    required: false,
    config: {
      rows: ['The product is reliable', 'Support is helpful'],
      scale: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    },
  },
  {
    id: 'q_image',
    type: 'image_choice',
    text: 'Which packaging do you prefer?',
    required: false,
    config: {
      multiSelect: false,
      imageOptions: [
        { label: 'Box A', imageUrl: 'https://example.com/a.png' },
        { label: 'Box B', imageUrl: 'https://example.com/b.png' },
      ],
    },
  },
  {
    id: 'q_file',
    type: 'file_upload',
    text: 'Optional: upload a screenshot if you saw an issue.',
    required: false,
    config: { maxSizeMB: 5, allowedTypes: ['image/png', 'image/jpeg'] },
  },
]

// Representative skip rule: hide the text follow-up if the rating is >= 9 (promoter, no extra explanation needed).
export const SKIP_RULE_HIDE_TEXT_IF_PROMOTER = {
  targetQuestionId: 'q_text',
  action: 'hide' as const,
  conditions: [
    {
      sourceQuestionId: 'q_rating',
      operator: 'gte' as const,
      value: 9,
    },
  ],
  conditionLogic: 'AND' as const,
}

export const SURVEY_ALL_TYPES = {
  id: 'srv_fixture_all_types',
  name: 'Fixture · all question types',
  title: 'Quick check-in',
  description: 'Renders one of every supported question type.',
  type: 'CUSTOM' as const,
  status: 'DRAFT' as const,
  programId: 'prg_fixture',
  themeId: 'thm_fixture_distinct',
  consentTextOverride: 'I agree to the {{privacy:"Privacy Policy"}} and {{terms:"Terms"}}.',
  responsePolicy: 'MULTIPLE' as const,
  thankYouMessage: 'Thanks! You earned {{points}} {{pointCurrencyName}}.',
  thankYouRedirectUrl: null,
  questions: QUESTIONS_ALL_TYPES.map((q) => ({
    ...q,
    skipRules: q.id === 'q_text' ? [SKIP_RULE_HIDE_TEXT_IF_PROMOTER] : undefined,
  })),
  settings: {
    chromeMatrix: {
      standalone: { logo: true, name: true, title: true },
      embedded: { logo: false, name: false, title: true },
    },
  },
  responsesCount: 0,
  updatedAt: new Date('2026-05-12T08:00:00Z').toISOString(),
}
