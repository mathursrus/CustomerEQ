import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

import LoopMonitor from './LoopMonitor'

// Issue #420 R39 — Survey Sent stat-card + per-mode breakdown.

const originalFetch = globalThis.fetch
const stubGetToken = async () => 'test-token'

function stubLoopMonitorResponse(body: object) {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch
}

describe('<LoopMonitor> — R39 Survey Sent breakdown', () => {
  beforeEach(() => {
    // Default: ACTIVE pipeline with the new surveysSentByMode field.
    stubLoopMonitorResponse({
      surveyId: 'srv_test',
      generatedAt: new Date().toISOString(),
      pipeline: {
        surveysSent: 11,
        surveysSentByMode: { MANAGED_EMAIL: 5, SELF_SERVE: 6 },
        responsesReceived: 4,
        scoreDistribution: { '0-6': 1, '7-8': 1, '9-10': 2 },
        rulesMatched: 0,
        campaignsTriggered: 0,
        loyaltyOutcomes: { pointsAwarded: 0, rewardsIssued: null, retentionDelta: null },
      },
      latency: { p50Ms: null, p95Ms: null, sampleSize: 0, slaStatus: 'ok' },
      warning: null,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders the Survey Sent stat-card with a per-mode breakdown sub-line', async () => {
    await act(async () => {
      render(<LoopMonitor surveyId="srv_test" surveyStatus="ACTIVE" getToken={stubGetToken} />)
    })

    const stage = await screen.findByTestId('stage-surveysSent')
    expect(stage).toHaveTextContent('11')
    expect(stage).toHaveTextContent('Survey Sent')

    const subline = screen.getByTestId('surveys-sent-by-mode')
    expect(subline).toHaveTextContent('5 via CustomerEQ')
    expect(subline).toHaveTextContent('6 via my email tool')
  })

  it('opens the Survey Sent drawer with both mode pills on click', async () => {
    await act(async () => {
      render(<LoopMonitor surveyId="srv_test" surveyStatus="ACTIVE" getToken={stubGetToken} />)
    })

    const stage = await screen.findByTestId('stage-surveysSent')
    await act(async () => {
      fireEvent.click(stage)
    })

    const drawer = screen.getByTestId('surveys-sent-drawer')
    expect(drawer).toHaveTextContent('5')
    expect(drawer).toHaveTextContent('via CustomerEQ Email')
    expect(drawer).toHaveTextContent('6')
    expect(drawer).toHaveTextContent('via my email tool')

    // Both pills present
    expect(screen.getByTestId('send-mode-pill-MANAGED_EMAIL')).toBeInTheDocument()
    expect(screen.getByTestId('send-mode-pill-SELF_SERVE')).toBeInTheDocument()
  })

  it('falls back to total-only when surveysSentByMode is missing', async () => {
    stubLoopMonitorResponse({
      surveyId: 'srv_test',
      generatedAt: new Date().toISOString(),
      pipeline: {
        surveysSent: 11,
        // surveysSentByMode intentionally omitted (e.g., older API response shape)
        responsesReceived: 4,
        scoreDistribution: {},
        rulesMatched: 0,
        campaignsTriggered: 0,
        loyaltyOutcomes: { pointsAwarded: 0, rewardsIssued: null, retentionDelta: null },
      },
      latency: { p50Ms: null, p95Ms: null, sampleSize: 0, slaStatus: 'ok' },
      warning: null,
    })

    await act(async () => {
      render(<LoopMonitor surveyId="srv_test" surveyStatus="ACTIVE" getToken={stubGetToken} />)
    })

    const stage = await screen.findByTestId('stage-surveysSent')
    expect(stage).toHaveTextContent('11')
    expect(screen.queryByTestId('surveys-sent-by-mode')).not.toBeInTheDocument()
  })
})
