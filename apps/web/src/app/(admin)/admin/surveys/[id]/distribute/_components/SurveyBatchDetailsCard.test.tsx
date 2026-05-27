// Issue #420 — SurveyBatchDetailsCard tests.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SurveyBatchDetailsCard } from './SurveyBatchDetailsCard'

describe('<SurveyBatchDetailsCard>', () => {
  it('renders the section heading and the two inputs', () => {
    render(
      <SurveyBatchDetailsCard
        surveyNameInMail="Q2 NPS"
        setSurveyNameInMail={vi.fn()}
        expiryPreset="7d"
        setExpiryPreset={vi.fn()}
        customExpiry=""
        setCustomExpiry={vi.fn()}
        brandTimezone="America/Los_Angeles"
      />,
    )
    expect(screen.getByRole('heading', { name: /Survey Batch details/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Survey name in mail/i)).toHaveValue('Q2 NPS')
    expect(screen.getByLabelText(/Links expire on/i)).toHaveValue('7d')
    expect(screen.getByText(/End of day in America\/Los_Angeles/i)).toBeInTheDocument()
  })

  it('shows the custom date+time picker when the operator picks custom', () => {
    const setExpiryPreset = vi.fn()
    render(
      <SurveyBatchDetailsCard
        surveyNameInMail="Q2 NPS"
        setSurveyNameInMail={vi.fn()}
        expiryPreset="custom"
        setExpiryPreset={setExpiryPreset}
        customExpiry="2026-06-01T23:59:00.000Z"
        setCustomExpiry={vi.fn()}
        brandTimezone="America/Los_Angeles"
      />,
    )
    expect(screen.getByDisplayValue('2026-06-01T23:59')).toBeInTheDocument()
    expect(screen.getByText(/All times in America\/Los_Angeles/i)).toBeInTheDocument()
  })

  it('calls setSurveyNameInMail on input edit', () => {
    const setSurveyNameInMail = vi.fn()
    render(
      <SurveyBatchDetailsCard
        surveyNameInMail=""
        setSurveyNameInMail={setSurveyNameInMail}
        expiryPreset="7d"
        setExpiryPreset={vi.fn()}
        customExpiry=""
        setCustomExpiry={vi.fn()}
        brandTimezone="UTC"
      />,
    )
    fireEvent.change(screen.getByLabelText(/Survey name in mail/i), {
      target: { value: 'Q3' },
    })
    expect(setSurveyNameInMail).toHaveBeenCalledWith('Q3')
  })
})
