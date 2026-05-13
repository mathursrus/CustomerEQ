import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoopMonitorSection } from './LoopMonitorSection'

// Issue #241 Slice 4a (round-2 / #335 feedback) — R32b: Loop Monitor is its
// own section, default-expanded for all survey states. Body embeds
// <LoopMonitor>, which fetches /v1/surveys/:id/loop-monitor on mount; stub
// fetch + getToken so the placeholder shell reaches the DOM synchronously.

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

describe('<LoopMonitorSection>', () => {
  it('renders the section header with the Loop Monitor title', () => {
    render(<LoopMonitorSection surveyId="srv_test" surveyStatus="DRAFT" getToken={stubGetToken} />)
    expect(screen.getByRole('heading', { name: /loop monitor/i })).toBeInTheDocument()
  })

  it('defaults expanded for DRAFT (placeholder reaches the DOM)', async () => {
    render(<LoopMonitorSection surveyId="srv_test" surveyStatus="DRAFT" getToken={stubGetToken} />)
    expect(await screen.findByTestId('loop-monitor-placeholder')).toBeInTheDocument()
  })

  it('defaults expanded for ACTIVE (placeholder via stubbed fetch reaches the DOM)', async () => {
    render(<LoopMonitorSection surveyId="srv_test" surveyStatus="ACTIVE" getToken={stubGetToken} />)
    expect(await screen.findByTestId('loop-monitor-placeholder')).toBeInTheDocument()
  })
})
