// Issue #241 Slice 4a — local types for the survey-form renderer family.
// `SurveyResolved` is not (yet) in @customerEQ/shared because the embed widget
// (Slice 5) is the second consumer and only then will a shared shape be
// justified. Keeping the type local for now avoids premature cross-package churn.

import type { SurveyQuestion } from '@customerEQ/shared'

export type Channel = 'standalone' | 'embedded'
export type Viewport = 'desktop' | 'mobile'
export type RendererMode = 'preview' | 'live'

export interface BrandLite {
  id: string
  name: string
  logoUrl: string | null
  consentTextDefault: string | null
  termsUrl: string | null
  privacyPolicyUrl: string | null
  memberIdentifierKind: 'email' | 'phone' | 'external_id'
}

export interface BrandThemeLite {
  id: string
  name: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
  fontFamily: string
  headingSize: 'sm' | 'md' | 'lg'
  bodySize: 'sm' | 'md' | 'lg'
  maxWidth: 'sm' | 'md' | 'lg'
  borderRadius: 'sm' | 'md' | 'lg'
  cardStyle: 'shadow' | 'border' | 'flat'
  backgroundImageUrl: string | null
}

export interface ChromeMatrix {
  standalone: { logo: boolean; name: boolean; title: boolean }
  embedded: { logo: boolean; name: boolean; title: boolean }
}

export interface SurveyResolved {
  id: string
  name: string
  title: string | null
  description: string | null
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'
  programId: string
  themeId: string | null
  questions: SurveyQuestion[]
  consentTextOverride: string | null
  responsePolicy: 'ONCE' | 'MULTIPLE' | 'LATEST_OVERWRITES'
  thankYouMessage: string
  thankYouRedirectUrl: string | null
  settings: { chromeMatrix?: ChromeMatrix } & Record<string, unknown>
}

export type AnswersState = Record<string, unknown>

export interface RendererInput {
  survey: SurveyResolved
  theme: BrandThemeLite
  brand: BrandLite
  channel: Channel
  viewport: Viewport
  mode: RendererMode
  readOnly?: boolean
  answers: AnswersState
  onAnswerChange?: (questionId: string, value: unknown) => void
}

export const DEFAULT_CHROME_MATRIX: ChromeMatrix = {
  standalone: { logo: true, name: true, title: true },
  embedded: { logo: false, name: false, title: true },
}
