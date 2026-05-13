import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfigurationSummarySection } from './ConfigurationSummarySection'
import { SURVEY_ALL_TYPES } from '@/components/survey-form/__fixtures__/survey-all-types'
import { THEME_DISTINCT } from '@/components/survey-form/__fixtures__/theme-default'

// Issue #241 Slice 4a — R28: renders the actual <PreviewSurvey> alongside the
// dl summary. Default expanded when responsesCount === 0.

const baseBrand = {
  id: 'brd_fixture',
  name: 'Fixture Brand',
  logoUrl: null,
  consentTextDefault: null,
  termsUrl: null,
  privacyPolicyUrl: null,
  memberIdentifierKind: 'email' as const,
}

describe('<ConfigurationSummarySection>', () => {
  it('defaults expanded when responsesCount === 0', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={0}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Quick check-in' })).toBeInTheDocument()
  })

  it('defaults collapsed when responsesCount > 0', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={5}
      />,
    )
    expect(screen.queryByRole('heading', { name: 'Quick check-in' })).toBeNull()
  })

  it('renders the four tab-aligned subsections in editor-tab order (R28 amendment)', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={0}
      />,
    )
    // Four <h4> subsection headers must appear in editor-tab order:
    // Basics → Questions → Look & Feel → Points & Thank You (R3 / R28).
    const headers = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headers).toEqual(['Basics', 'Questions', 'Look & Feel', 'Points & Thank You'])
  })

  it('surfaces the program name and the response policy under Basics', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={0}
      />,
    )
    expect(screen.getByText('Fixture Program')).toBeInTheDocument()
    expect(screen.getByText(/Multiple responses/i)).toBeInTheDocument()
  })

  it('notes that points are configured in the program under Points & Thank You', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={0}
      />,
    )
    expect(screen.getByText(/Set in the program/i)).toBeInTheDocument()
  })
})
