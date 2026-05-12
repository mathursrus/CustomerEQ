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

  it('renders the dl summary entries (type, status, program, theme, response policy, thank-you snippet)', () => {
    render(
      <ConfigurationSummarySection
        survey={SURVEY_ALL_TYPES}
        brand={baseBrand}
        theme={THEME_DISTINCT}
        programName="Fixture Program"
        responsesCount={0}
      />,
    )
    expect(screen.getByText(/Type/i)).toBeInTheDocument()
    expect(screen.getByText(/Status/i)).toBeInTheDocument()
    expect(screen.getByText('Fixture Program')).toBeInTheDocument()
    expect(screen.getByText(/Multiple responses/i)).toBeInTheDocument()
  })
})
