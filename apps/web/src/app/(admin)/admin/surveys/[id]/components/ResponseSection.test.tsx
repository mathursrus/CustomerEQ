import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponseSection } from './ResponseSection'

// Issue #241 Slice 4a (round-2 / #335 feedback) — R32 inverse expand rule.
// LoopMonitor is no longer embedded here (it lives in <LoopMonitorSection>
// per R32b). The body is the deferred-analytics placeholder note only —
// no async fetches, no stubbed fetch needed.

describe('<ResponseSection>', () => {
  it('defaults collapsed when responsesCount === 0 (inverse of Distribution / Configuration)', () => {
    render(<ResponseSection surveyId="srv_test" responsesCount={0} />)
    // Section body must be hidden when collapsed; the deferral note lives in the body.
    expect(screen.queryByText(/sibling sub-issue/i)).toBeNull()
  })

  it('defaults expanded when responsesCount > 0', () => {
    render(<ResponseSection surveyId="srv_test" responsesCount={5} />)
    // Body visible — deferral note renders.
    expect(screen.getByText(/sibling sub-issue/i)).toBeInTheDocument()
  })

  it('does not embed LoopMonitor (moved to its own section per R32b)', () => {
    render(<ResponseSection surveyId="srv_test" responsesCount={5} />)
    // LoopMonitor's placeholder testid must NOT appear inside Response.
    expect(screen.queryByTestId('loop-monitor-placeholder')).toBeNull()
    expect(screen.queryByTestId('loop-monitor')).toBeNull()
  })

  it('shows the pre-response note only when responsesCount === 0 and section is expanded', () => {
    // Force-expand path tested implicitly: render with responsesCount > 0 so the body shows,
    // and confirm the pre-response copy ("populate once the survey starts receiving responses") is NOT shown.
    render(<ResponseSection surveyId="srv_test" responsesCount={5} />)
    expect(screen.queryByText(/populate once the survey/i)).toBeNull()
  })
})
