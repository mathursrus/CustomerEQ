import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponseSection } from './ResponseSection'

// Issue #241 Slice 4a — R32 inverse expand rule.
// Body embeds <LoopMonitor> (Issue #80 hero pipeline view). Stub its
// /v1/surveys/:id/loop-monitor fetch and stub getToken so the component
// reaches its visible state synchronously in jsdom.

const originalFetch = globalThis.fetch
const stubGetToken = async () => 'test-token'

beforeEach(() => {
  globalThis.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({ surveyId: 'srv_test', placeholder: true, message: 'no data yet' }),
      { status: 200 },
    ),
  ) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('<ResponseSection>', () => {
  it('defaults collapsed when responsesCount === 0 (inverse of Distribution / Configuration)', () => {
    render(
      <ResponseSection
        surveyId="srv_test"
        surveyStatus="DRAFT"
        responsesCount={0}
        getToken={stubGetToken}
      />,
    )
    // LoopMonitor's loading shell or placeholder must NOT be rendered when section is collapsed.
    expect(screen.queryByTestId('loop-monitor-placeholder')).toBeNull()
    expect(screen.queryByTestId('loop-monitor')).toBeNull()
  })

  it('defaults expanded when responsesCount > 0', () => {
    render(
      <ResponseSection
        surveyId="srv_test"
        surveyStatus="DRAFT"
        responsesCount={5}
        getToken={stubGetToken}
      />,
    )
    // DRAFT surveys show LoopMonitor's placeholder ("activates when survey is live")
    expect(screen.getByTestId('loop-monitor-placeholder')).toBeInTheDocument()
  })

  it('renders the analytics deferral note alongside the LoopMonitor', () => {
    render(
      <ResponseSection
        surveyId="srv_test"
        surveyStatus="DRAFT"
        responsesCount={1}
        getToken={stubGetToken}
      />,
    )
    expect(screen.getByText(/sibling sub-issue/i)).toBeInTheDocument()
  })
})
