import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SurveyFormRenderer } from './SurveyFormRenderer'
import { SURVEY_ALL_TYPES } from './__fixtures__/survey-all-types'
import { THEME_DISTINCT } from './__fixtures__/theme-default'

// Issue #241 Slice 4a — acceptance: "All 11 question types render correctly".
// Plus R12-R14 consent rendering and skip-rule filtering.

function renderInPreviewMode(extra: Partial<Parameters<typeof SurveyFormRenderer>[0]> = {}) {
  return render(
    <SurveyFormRenderer
      survey={SURVEY_ALL_TYPES}
      theme={THEME_DISTINCT}
      brand={{ id: 'brd_fixture', name: 'Fixture Brand', logoUrl: null, consentTextDefault: null, termsUrl: null, privacyPolicyUrl: null, memberIdentifierKind: 'email' }}
      channel="standalone"
      viewport="desktop"
      mode="preview"
      answers={{}}
      onAnswerChange={() => {}}
      {...extra}
    />,
  )
}

describe('<SurveyFormRenderer> · 11 question types', () => {
  it('renders the survey title', () => {
    renderInPreviewMode()
    expect(screen.getByRole('heading', { name: 'Quick check-in' })).toBeInTheDocument()
  })

  it('renders the rating question with 0-10 buttons', () => {
    renderInPreviewMode()
    const question = screen.getByText('How likely are you to recommend us?').closest('[data-question-id]') as HTMLElement
    expect(question).not.toBeNull()
    // 11 buttons for 0 through 10 inclusive
    expect(within(question).getAllByRole('button')).toHaveLength(11)
  })

  it('renders the text question as a textarea (multiline config)', () => {
    renderInPreviewMode()
    expect(screen.getByPlaceholderText('Your thoughts…')).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('renders the choice question as radio buttons', () => {
    renderInPreviewMode()
    const question = screen.getByText('Pick the best option.').closest('[data-question-id]') as HTMLElement
    expect(within(question).getAllByRole('radio')).toHaveLength(4)
  })

  it('renders the multiple_choice question as radio buttons + an "Other" affordance when allowOther', () => {
    renderInPreviewMode()
    const question = screen.getByText('Which channel did you use?').closest('[data-question-id]') as HTMLElement
    // 3 named options + 1 "Other" = 4 radios
    expect(within(question).getAllByRole('radio').length).toBeGreaterThanOrEqual(3)
    expect(within(question).getByText(/other/i)).toBeInTheDocument()
  })

  it('renders the checkbox question as checkboxes', () => {
    renderInPreviewMode()
    const question = screen.getByText('Which features do you use? (select all that apply)').closest('[data-question-id]') as HTMLElement
    expect(within(question).getAllByRole('checkbox')).toHaveLength(4)
  })

  it('renders the dropdown question as a select', () => {
    renderInPreviewMode()
    const question = screen.getByText('Where did you hear about us?').closest('[data-question-id]') as HTMLElement
    expect(within(question).getByRole('combobox')).toBeInstanceOf(HTMLSelectElement)
  })

  it('renders the matrix question as a table with rows × columns', () => {
    renderInPreviewMode()
    const question = screen.getByText('Rate each aspect of our service.').closest('[data-question-id]') as HTMLElement
    expect(within(question).getByRole('table')).toBeInTheDocument()
    // 3 row labels
    expect(within(question).getByText('Speed')).toBeInTheDocument()
    expect(within(question).getByText('Quality')).toBeInTheDocument()
    expect(within(question).getByText('Support')).toBeInTheDocument()
  })

  it('renders the ranking question as an ordered list of draggable / movable items', () => {
    renderInPreviewMode()
    const question = screen.getByText('Rank these features from most to least important.').closest('[data-question-id]') as HTMLElement
    // 4 option entries — exposing them as listitems for accessibility
    expect(within(question).getAllByRole('listitem')).toHaveLength(4)
  })

  it('renders the slider question as a range input with min/max', () => {
    renderInPreviewMode()
    const question = screen.getByText('How satisfied are you overall?').closest('[data-question-id]') as HTMLElement
    const slider = within(question).getByRole('slider') as HTMLInputElement
    expect(slider).toBeInstanceOf(HTMLInputElement)
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('100')
  })

  it('renders the likert question as a matrix of statement × scale', () => {
    renderInPreviewMode()
    const question = screen.getByText('Please indicate your agreement.').closest('[data-question-id]') as HTMLElement
    expect(within(question).getByRole('table')).toBeInTheDocument()
    expect(within(question).getByText('Strongly agree')).toBeInTheDocument()
  })

  it('renders the image_choice question with two image-labeled options', () => {
    renderInPreviewMode()
    const question = screen.getByText('Which packaging do you prefer?').closest('[data-question-id]') as HTMLElement
    expect(within(question).getAllByRole('img')).toHaveLength(2)
  })

  it('renders the file_upload question as a disabled placeholder in preview mode', () => {
    renderInPreviewMode()
    const question = screen.getByText(/Optional: upload a screenshot/).closest('[data-question-id]') as HTMLElement
    // Native file input present but disabled in preview mode
    const file = within(question).getByLabelText(/Optional: upload a screenshot/i, { exact: false }) as HTMLInputElement
    expect(file).toBeInstanceOf(HTMLInputElement)
    expect(file.type).toBe('file')
    expect(file.disabled).toBe(true)
  })
})

describe('<SurveyFormRenderer> · consent + skip rules', () => {
  it('renders the consent disclosure with privacy + terms links when the survey has consentTextOverride', () => {
    renderInPreviewMode({
      brand: { id: 'brd_fixture', name: 'Fixture Brand', logoUrl: null, consentTextDefault: null, termsUrl: 'https://example.com/terms', privacyPolicyUrl: 'https://example.com/privacy', memberIdentifierKind: 'email' },
    })
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument()
  })

  it('hides a question whose skip rule fires (q_text hidden when rating >= 9)', () => {
    renderInPreviewMode({ answers: { q_rating: 9 } })
    expect(screen.queryByText('Tell us why you gave that score.')).toBeNull()
  })

  it('shows the same question when its skip rule does not fire (rating < 9)', () => {
    renderInPreviewMode({ answers: { q_rating: 7 } })
    expect(screen.getByText('Tell us why you gave that score.')).toBeInTheDocument()
  })
})

describe('<SurveyFormRenderer> · CSS variable contract (R31)', () => {
  it('applies theme tokens as CSS custom properties on the survey card root', () => {
    const { container } = renderInPreviewMode()
    const card = container.querySelector('.ceq-survey-card') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.style.getPropertyValue('--ceq-primary-color')).toBe('#0a84ff')
    expect(card.style.getPropertyValue('--ceq-button-color')).toBe('#34c759')
    expect(card.style.getPropertyValue('--ceq-max-width')).toBe('800px')
  })
})

// Issue #413 — "Powered by CustomerEQ" footer is non-toggleable (R7),
// rendered inside the themed card (R1), and emits identically in both
// preview and live modes (R9 preview/live parity).
describe('<SurveyFormRenderer> · Issue #413 attribution footer', () => {
  it('renders the themed PoweredByFooter inside the survey card (R1)', () => {
    const { container } = renderInPreviewMode()
    const card = container.querySelector('.ceq-survey-card') as HTMLElement
    expect(card).not.toBeNull()
    const footer = card.querySelector('[data-survey-footer]')
    expect(footer).not.toBeNull()
    expect(footer?.classList.contains('ceq-powered-by--themed')).toBe(true)
  })

  it('emits the same footer DOM in preview mode and live mode (R9 parity)', () => {
    const { container: previewContainer } = renderInPreviewMode({ mode: 'preview' })
    const { container: liveContainer } = renderInPreviewMode({ mode: 'live' })

    const previewFooter = previewContainer.querySelector('[data-survey-footer]')
    const liveFooter = liveContainer.querySelector('[data-survey-footer]')

    expect(previewFooter).not.toBeNull()
    expect(liveFooter).not.toBeNull()
    expect(liveFooter!.outerHTML).toBe(previewFooter!.outerHTML)
  })

  it('renders the footer regardless of chrome-matrix settings (R7 non-toggleable)', () => {
    // chromeMatrix.standalone with everything off — footer must still render.
    const { container } = renderInPreviewMode({
      survey: {
        ...SURVEY_ALL_TYPES,
        settings: {
          chromeMatrix: {
            standalone: { logo: false, name: false, title: false },
            embedded: { logo: false, name: false, title: false },
          },
        },
      },
    })
    expect(container.querySelector('[data-survey-footer]')).not.toBeNull()
  })

  it('renders the footer link with utm_medium=link for standalone-channel rendering', () => {
    const { container } = renderInPreviewMode()
    const link = container.querySelector('[data-survey-footer] a') as HTMLAnchorElement
    expect(link).not.toBeNull()
    const url = new URL(link.href)
    expect(url.searchParams.get('utm_medium')).toBe('link')
  })
})
