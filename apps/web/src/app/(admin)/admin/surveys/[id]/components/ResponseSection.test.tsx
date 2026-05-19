import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Issue #423 — `ResponseSection` is now a stateful client component that
// fetches from `GET /v1/surveys/:id/responses`. The unit tests below cover
// the shallow rendering paths only (empty state, count badge, export-button
// disabled state); the full filter / fetch / pagination flow is exercised in
// the E2E Playwright suite (`tests/e2e/423-response-review.spec.ts`).

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}))
vi.mock('@/lib/config', () => ({
  API_URL: 'http://localhost:8000',
  getAuthToken: async () => 'test-token',
}))

import { ResponseSection } from './ResponseSection'

const baseProps = {
  surveyId: 'srv_test',
  surveyType: 'NPS',
  surveyName: 'Test NPS',
  brandTimezone: 'America/Los_Angeles',
  brandLocale: 'en-US',
  questions: [
    { id: 'q1', text: 'How likely are you to recommend us?', type: 'rating' as const },
    { id: 'q2', text: 'What could we do better?', type: 'text' as const },
  ],
  wave: 'all' as const,
}

describe('<ResponseSection> — header, badge, and export state', () => {
  beforeEach(() => {
    // Stub global fetch so the effect doesn't actually hit the network.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 1, filters: { scoreBandGate: { hidden: false }, sentimentBandGate: { hidden: false } } }),
    } as unknown as Response)
  })

  it('renders the count badge inside the title even when collapsed (responsesCount === 0)', () => {
    render(<ResponseSection {...baseProps} responsesCount={0} />)
    expect(screen.getByTestId('response-count-badge')).toBeInTheDocument()
  })

  it('disables the Export button when responsesCount === 0', () => {
    render(<ResponseSection {...baseProps} responsesCount={0} />)
    const exportBtn = screen.getByTestId('response-export-button')
    expect(exportBtn).toHaveAttribute('aria-disabled', 'true')
    expect(exportBtn).toHaveAttribute('title', expect.stringMatching(/Nothing to export/i))
  })

  it('renders the count badge when responsesCount > 0 (section expanded by default)', () => {
    render(<ResponseSection {...baseProps} responsesCount={5} />)
    expect(screen.getByTestId('response-count-badge')).toBeInTheDocument()
  })
})
