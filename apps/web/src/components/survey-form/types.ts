// Issue #241 Slice 4a — local types for the survey-form renderer family.
// `SurveyResolved` is not (yet) in @customerEQ/shared because the embed widget
// (Slice 5) is the second consumer and only then will a shared shape be
// justified. Keeping the type local for now avoids premature cross-package churn.

import type { ReactNode } from 'react'

import type { SurveyQuestion } from '@customerEQ/shared'

export type Channel = 'standalone' | 'embedded'
export type Viewport = 'desktop' | 'mobile'
export type RendererMode = 'preview' | 'live'

export interface BrandLite {
  id: string
  name: string
  logoUrl: string | null
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
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
  // Issue #241 — survey-level consent override. Null → inherit brand default.
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT' | null
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
  /**
   * Slot rendered above the question list (between title and questions).
   * Used by the live respondent page to inject the member-id input per R15
   * without bleeding respondent-state plumbing into the renderer.
   */
  prefixSlot?: ReactNode
  /**
   * Fires when the form is submitted in mode='live'. Preview mode ignores.
   */
  onSubmit?: () => void
  submitLabel?: string
  submitDisabled?: boolean
  /**
   * Controlled consent-checkbox state for the EXPLICIT consent path.
   * The respondent page tracks this so it can include `consent: true` in
   * the POST body — the API rejects with 400 CONSENT_REQUIRED otherwise.
   * Preview mode ignores both and renders an interactive but disabled box.
   */
  consentChecked?: boolean
  onConsentCheckedChange?: (next: boolean) => void
  /**
   * Field-level validation errors surfaced by the respondent page. Each
   * value renders next to the offending control (consent → under the
   * checkbox; questions → under the question card) so the operator sees
   * what's missing inline rather than via a generic banner.
   */
  errors?: {
    consent?: string
    questions?: Record<string, string>
  }
}

export const DEFAULT_CHROME_MATRIX: ChromeMatrix = {
  standalone: { logo: true, name: true, title: true },
  embedded: { logo: false, name: false, title: true },
}
