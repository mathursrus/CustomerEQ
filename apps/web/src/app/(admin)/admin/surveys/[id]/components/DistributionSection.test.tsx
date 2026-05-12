import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DistributionSection } from './DistributionSection'

// Issue #241 Slice 4a — Spec §7 Distribution tile bar (4 tiles).
// R27: default expanded when responsesCount===0; admin can override via chevron.

const writeText = vi.fn(async () => {})

beforeEach(() => {
  writeText.mockClear()
  // jsdom 25 exposes navigator.clipboard as a getter-only property; reassign
  // via defineProperty so the mock takes effect.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

describe('<DistributionSection>', () => {
  it('defaults expanded when responsesCount === 0', () => {
    render(<DistributionSection surveyId="srv_abc" status="DRAFT" responsesCount={0} apiUrl="https://api.example" />)
    expect(screen.getByText(/share link/i)).toBeInTheDocument()
  })

  it('defaults collapsed when responsesCount > 0', () => {
    render(<DistributionSection surveyId="srv_abc" status="ACTIVE" responsesCount={42} apiUrl="https://api.example" />)
    expect(screen.queryByText(/share link/i)).toBeNull()
  })

  it('renders the share link tile with the canonical URL and a Copy button', async () => {
    render(<DistributionSection surveyId="srv_abc" status="ACTIVE" responsesCount={0} apiUrl="https://api.example" />)
    const copy = screen.getByRole('button', { name: /copy share link/i })
    fireEvent.click(copy)
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect((writeText.mock.calls[0]?.[0] as string).endsWith('/survey/srv_abc')).toBe(true)
  })

  it('renders the embed snippet tile with the script tag and a Copy button', async () => {
    render(<DistributionSection surveyId="srv_abc" status="ACTIVE" responsesCount={0} apiUrl="https://api.example" />)
    const copy = screen.getByRole('button', { name: /copy embed snippet/i })
    fireEvent.click(copy)
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]?.[0] as string).toBe(
      '<script src="https://api.example/v1/public/surveys/srv_abc/widget.js"></script>',
    )
  })

  it('renders the email integration tile as a "Coming soon" stub (no wired action)', () => {
    render(<DistributionSection surveyId="srv_abc" status="ACTIVE" responsesCount={0} apiUrl="https://api.example" />)
    expect(screen.getByText(/email integration/i)).toBeInTheDocument()
    // Both email + QR tiles render "Coming soon"; assert there are exactly two such markers
    // so neither stub silently loses its placeholder.
    expect(screen.getAllByText(/coming soon/i)).toHaveLength(2)
  })

  it('renders the QR code tile as a "Coming soon" stub', () => {
    render(<DistributionSection surveyId="srv_abc" status="ACTIVE" responsesCount={0} apiUrl="https://api.example" />)
    expect(screen.getByText(/qr code/i)).toBeInTheDocument()
  })
})
