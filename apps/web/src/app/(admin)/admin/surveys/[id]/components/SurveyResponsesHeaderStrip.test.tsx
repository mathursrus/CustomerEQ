import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SurveyResponsesHeaderStrip } from './SurveyResponsesHeaderStrip'

const baseBatches = [
  {
    id: 'btch_a',
    label: 'Q2 2026 NPS · 2026-05-21',
    createdAt: '2026-05-21T14:02:00.000Z',
    sentCount: 5,
    respondedCount: 2,
  },
  {
    id: 'btch_b',
    label: 'Q2 2026 NPS · 2026-05-20',
    createdAt: '2026-05-20T18:08:00.000Z',
    sentCount: 6,
    respondedCount: 2,
  },
]

const baseProps = {
  surveyId: 'srv_test',
  surveyLifetimeSentCount: 11,
  batches: baseBatches,
  hasDirectResponses: true,
  selectedWave: 'all' as const,
  onWaveChange: vi.fn(),
  filteredResponseCount: 4,
  brandTimezone: 'America/Los_Angeles',
  brandLocale: 'en-US',
}

describe('<SurveyResponsesHeaderStrip>', () => {
  it('shows lifetime Sent + filtered Responses + percent when wave is "all"', () => {
    render(<SurveyResponsesHeaderStrip {...baseProps} />)
    const sent = screen.getByTestId('responses-header-sent')
    expect(sent).toHaveTextContent('Survey Sent:')
    expect(sent).toHaveTextContent('11')
    expect(sent).toHaveTextContent('lifetime · changes with Wave filter')

    const responses = screen.getByTestId('responses-header-responses')
    expect(responses).toHaveTextContent('Responses:')
    expect(responses).toHaveTextContent('4 of 11')
    expect(responses).toHaveTextContent('(36% · response filters apply)')
  })

  it('switches Sent to the wave-level count and hides the Details link when wave="all"', () => {
    render(<SurveyResponsesHeaderStrip {...baseProps} />)
    expect(screen.queryByTestId('responses-wave-details-link')).toBeNull()
  })

  it('shows the wave\'s sent count + Details link when a specific batch is selected', () => {
    render(
      <SurveyResponsesHeaderStrip
        {...baseProps}
        selectedWave={{ batchId: 'btch_a' }}
        filteredResponseCount={2}
      />,
    )
    expect(screen.getByTestId('responses-header-sent')).toHaveTextContent('5')
    expect(screen.getByTestId('responses-header-sent')).toHaveTextContent('this wave')
    expect(screen.getByTestId('responses-header-responses')).toHaveTextContent('2 of 5')
    expect(screen.getByTestId('responses-header-responses')).toHaveTextContent('(40%')
    const link = screen.getByTestId('responses-wave-details-link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/surveys/srv_test/distribute/batches/btch_a')
  })

  it('renders Sent as em-dash for the "Direct" wave (platform has no Sent record)', () => {
    render(
      <SurveyResponsesHeaderStrip
        {...baseProps}
        selectedWave="direct"
        filteredResponseCount={3}
      />,
    )
    expect(screen.getByTestId('responses-header-sent')).toHaveTextContent('—')
    expect(screen.getByTestId('responses-header-sent')).toHaveTextContent('n/a for direct responses')
    // No "of N" since N is unknown.
    expect(screen.getByTestId('responses-header-responses')).toHaveTextContent('Responses: 3')
    expect(screen.getByTestId('responses-header-responses')).not.toHaveTextContent('of')
  })

  it('omits the "Direct responses" option when hasDirectResponses is false', () => {
    render(<SurveyResponsesHeaderStrip {...baseProps} hasDirectResponses={false} />)
    const select = screen.getByTestId('responses-wave-select')
    expect(select).not.toHaveTextContent('Direct responses')
  })

  it('calls onWaveChange("all") when "All waves" option is selected', () => {
    const onWaveChange = vi.fn()
    render(
      <SurveyResponsesHeaderStrip
        {...baseProps}
        selectedWave={{ batchId: 'btch_a' }}
        onWaveChange={onWaveChange}
      />,
    )
    const select = screen.getByTestId('responses-wave-select')
    fireEvent.change(select, { target: { value: 'all' } })
    expect(onWaveChange).toHaveBeenCalledWith('all')
  })

  it('calls onWaveChange({ batchId }) when a specific batch is selected', () => {
    const onWaveChange = vi.fn()
    render(<SurveyResponsesHeaderStrip {...baseProps} onWaveChange={onWaveChange} />)
    const select = screen.getByTestId('responses-wave-select')
    fireEvent.change(select, { target: { value: 'btch_b' } })
    expect(onWaveChange).toHaveBeenCalledWith({ batchId: 'btch_b' })
  })

  it('calls onWaveChange("direct") when Direct option is selected', () => {
    const onWaveChange = vi.fn()
    render(<SurveyResponsesHeaderStrip {...baseProps} onWaveChange={onWaveChange} />)
    const select = screen.getByTestId('responses-wave-select')
    fireEvent.change(select, { target: { value: 'direct' } })
    expect(onWaveChange).toHaveBeenCalledWith('direct')
  })

  it('renders 0%-equivalent suffix when sent>0 but responses=0', () => {
    render(<SurveyResponsesHeaderStrip {...baseProps} filteredResponseCount={0} />)
    expect(screen.getByTestId('responses-header-responses')).toHaveTextContent('0 of 11')
    expect(screen.getByTestId('responses-header-responses')).toHaveTextContent('(0%')
  })
})
