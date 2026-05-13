// Issue #241 Slice 4b (#336) — Co-located fixtures for editor RTL suite.
//
// Why these live here, not in packages/config/src/test-utils/:
// packages/config DB factories call into Prisma at the integration tier; admin
// editor tests need plain in-memory objects matching the API runtime shape
// observed at Slice 4a Round 1 Cluster B (Survey.settings nullable, Survey.title
// nullable in DRAFT, etc.). Slice 4a's apps/web/src/components/survey-form/
// __fixtures__/ established this co-location pattern.

import type { BrandLite, BrandThemeLite, SurveyResolved } from '@/components/survey-form/types'
import type { SurveyQuestion } from '@customerEQ/shared'

// Editor-scoped brand widens BrandLite with consentMode (needed for R10/R11
// override-vs-default comparison). BrandLite stays narrow because the renderer
// itself doesn't care about consentMode — only the editor does.
export interface EditorBrand extends BrandLite {
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
}

// Editor-scoped survey accepts settings: null (Slice 4a Cluster B runtime
// shape) and adds the consent-attestation fields populated by R10 attestation.
export interface EditorSurvey extends Omit<SurveyResolved, 'settings'> {
  settings: SurveyResolved['settings'] | null
  consentSuppressedAttestedBy?: string | null
  consentSuppressedAttestedAt?: string | null
  consentReason?: string | null
}

export const DRAFT_SURVEY_ID = 'srv_test_4b_draft'
export const ACTIVE_SURVEY_ID = 'srv_test_4b_active'
export const STOPPED_SURVEY_ID = 'srv_test_4b_stopped'
export const PROGRAM_ID_NPS = 'prg_test_4b_nps'
export const PROGRAM_ID_CSAT = 'prg_test_4b_csat'
export const THEME_ID_DEFAULT = 'thm_test_4b_default'
export const THEME_ID_ALT = 'thm_test_4b_alt'
export const BRAND_ID = 'brd_test_4b_001'

const SEED_NPS_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q_seed',
    type: 'rating',
    text: 'How likely are you to recommend us?',
    required: true,
    config: { min: 0, max: 10 },
  },
]

const TWO_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q_rating',
    type: 'rating',
    text: 'How likely are you to recommend us?',
    required: true,
    config: { min: 0, max: 10 },
  },
  { id: 'q_text', type: 'text', text: 'Tell us why.', required: false, config: { multiline: true } },
]

// Empty-but-valid draft: name set but title null (first time the operator
// opens the editor after /new POST creates the row).
export const MOCK_DRAFT_SURVEY: EditorSurvey = {
  id: DRAFT_SURVEY_ID,
  name: 'Untitled survey',
  title: null,
  description: null,
  type: 'NPS',
  status: 'DRAFT',
  programId: PROGRAM_ID_NPS,
  themeId: THEME_ID_DEFAULT,
  consentTextOverride: null,
  responsePolicy: 'MULTIPLE',
  thankYouMessage: 'Thanks for your feedback!',
  thankYouRedirectUrl: null,
  questions: SEED_NPS_QUESTIONS,
  settings: null, // Slice 4a Cluster B — settings is null for fresh drafts.
}

export const MOCK_ACTIVE_SURVEY: EditorSurvey = {
  ...MOCK_DRAFT_SURVEY,
  id: ACTIVE_SURVEY_ID,
  name: 'NPS check-in — Q2',
  title: 'Quick NPS pulse',
  description: 'Loyalty NPS — 0-to-10 + verbatim',
  status: 'ACTIVE',
  questions: TWO_QUESTIONS,
  settings: {
    chromeMatrix: {
      standalone: { logo: true, name: true, title: true },
      embedded: { logo: false, name: false, title: true },
    },
  },
}

export const MOCK_STOPPED_SURVEY: EditorSurvey = {
  ...MOCK_ACTIVE_SURVEY,
  id: STOPPED_SURVEY_ID,
  status: 'STOPPED',
}

// Brand with consentMode=EXPLICIT — drives R10 more-permissive-override flow.
export const MOCK_BRAND_EXPLICIT: EditorBrand = {
  id: BRAND_ID,
  name: 'Acme Coffee Roasters',
  logoUrl: null,
  consentTextDefault: 'I agree to receive feedback messages.',
  termsUrl: 'https://acme.test/terms',
  privacyPolicyUrl: 'https://acme.test/privacy',
  memberIdentifierKind: 'email',
  consentMode: 'EXPLICIT',
}

// Brand without termsUrl — R12 toolbar must hide Terms button.
export const MOCK_BRAND_NO_TERMS: EditorBrand = {
  ...MOCK_BRAND_EXPLICIT,
  termsUrl: null,
}

// Brand with consentMode=IMPLIED_ON_SUBMIT — drives R11 stricter-override (no attestation).
export const MOCK_BRAND_IMPLIED: EditorBrand = {
  ...MOCK_BRAND_EXPLICIT,
  consentMode: 'IMPLIED_ON_SUBMIT',
}

export const MOCK_THEME_DEFAULT: BrandThemeLite = {
  id: THEME_ID_DEFAULT,
  name: 'Indigo · default',
  primaryColor: '#6366f1',
  secondaryColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#6366f1',
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  maxWidth: 'md',
  borderRadius: 'md',
  cardStyle: 'shadow',
  backgroundImageUrl: null,
}

export const MOCK_THEME_ALT: BrandThemeLite = {
  ...MOCK_THEME_DEFAULT,
  id: THEME_ID_ALT,
  name: 'Slate · alt',
  primaryColor: '#0f172a',
  buttonColor: '#0f172a',
}

export const MOCK_THEME_LIBRARY: BrandThemeLite[] = [MOCK_THEME_DEFAULT, MOCK_THEME_ALT]

// Program with EarningRule for NPS cxEvent — drives PointsAndThankYouTab R20
// read-only display ("Earn 25 points for completing this survey").
export interface ProgramWithEarningRule {
  id: string
  name: string
  pointCurrencyName: string
  earningRules: Array<{ cxEventForType: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'; pointsAwarded: number }>
}

export const MOCK_PROGRAM_NPS_WITH_RULE: ProgramWithEarningRule = {
  id: PROGRAM_ID_NPS,
  name: 'Acme Coffee Loyalty',
  pointCurrencyName: 'Beans',
  earningRules: [{ cxEventForType: 'NPS', pointsAwarded: 25 }],
}

// Program with NO EarningRule for the selected type — R20 fallback copy.
export const MOCK_PROGRAM_CSAT_NO_RULE: ProgramWithEarningRule = {
  id: PROGRAM_ID_CSAT,
  name: 'Acme Coffee Loyalty (CSAT-less)',
  pointCurrencyName: 'Beans',
  earningRules: [],
}
