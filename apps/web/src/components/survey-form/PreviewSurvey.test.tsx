import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviewSurvey } from './PreviewSurvey'
import { SURVEY_ALL_TYPES } from './__fixtures__/survey-all-types'
import { THEME_DISTINCT } from './__fixtures__/theme-default'

// Issue #241 Slice 4a — R17 / R18 channel × viewport behavior.
// Standalone channel shows brand chrome per matrix; embedded honors a more
// restrictive matrix.

const baseBrand = {
  id: 'brd_fixture',
  name: 'Fixture Brand',
  logoUrl: 'https://example.com/logo.png',
  consentTextDefault: null,
  termsUrl: null,
  privacyPolicyUrl: null,
  memberIdentifierKind: 'email' as const,
}

describe('<PreviewSurvey>', () => {
  it('shows brand logo + name + survey title on the standalone channel per chromeMatrix', () => {
    render(
      <PreviewSurvey
        survey={SURVEY_ALL_TYPES}
        theme={THEME_DISTINCT}
        brand={baseBrand}
        channel="standalone"
        viewport="desktop"
        readOnly
      />,
    )
    expect(screen.getByAltText(/Fixture Brand/i)).toBeInTheDocument()
    expect(screen.getByText('Fixture Brand')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick check-in' })).toBeInTheDocument()
  })

  it('hides brand logo + name on the embedded channel per chromeMatrix (logo/name=false)', () => {
    render(
      <PreviewSurvey
        survey={SURVEY_ALL_TYPES}
        theme={THEME_DISTINCT}
        brand={baseBrand}
        channel="embedded"
        viewport="desktop"
        readOnly
      />,
    )
    expect(screen.queryByAltText(/Fixture Brand/i)).toBeNull()
    // The brand-name header should not appear (matrix says embedded.name=false). Survey title still appears.
    expect(screen.queryByText('Fixture Brand')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Quick check-in' })).toBeInTheDocument()
  })

  it('applies a "mobile" viewport class to the wrapping container when viewport=mobile', () => {
    const { container } = render(
      <PreviewSurvey
        survey={SURVEY_ALL_TYPES}
        theme={THEME_DISTINCT}
        brand={baseBrand}
        channel="standalone"
        viewport="mobile"
        readOnly
      />,
    )
    const viewport = container.querySelector('[data-viewport]')
    expect(viewport?.getAttribute('data-viewport')).toBe('mobile')
  })

  it('marks the survey card as read-only when readOnly=true', () => {
    const { container } = render(
      <PreviewSurvey
        survey={SURVEY_ALL_TYPES}
        theme={THEME_DISTINCT}
        brand={baseBrand}
        channel="standalone"
        viewport="desktop"
        readOnly
      />,
    )
    const card = container.querySelector('.ceq-survey-card') as HTMLElement
    expect(card?.getAttribute('aria-readonly')).toBe('true')
  })
})
