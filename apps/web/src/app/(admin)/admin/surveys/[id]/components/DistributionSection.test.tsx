import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DistributionSection } from './DistributionSection'

// Issue #241 Slice 4a (round-2 / #335 feedback) — Spec §7 Distribution.
// R27: default expanded when responsesCount===0; admin can override via chevron.
// Round-2 changes:
//  - Email + QR tiles removed.
//  - DRAFT-state banner added (R33).
//  - Embed snippet includes data-prefill attrs (R34) scoped to brand.memberIdentifierKind.

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
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="DRAFT"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    expect(screen.getByText('Share link')).toBeInTheDocument()
  })

  it('defaults collapsed when responsesCount > 0', () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={42}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    expect(screen.queryByText('Share link')).toBeNull()
  })

  it('renders the share link tile with the canonical URL and a Copy button', async () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    const copy = screen.getByRole('button', { name: /copy share link/i })
    fireEvent.click(copy)
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect((writeText.mock.calls[0]?.[0] as string).endsWith('/survey/srv_abc')).toBe(true)
  })

  it('renders the embed snippet with data-survey, data-prefill-email, first-name and last-name (R34, email kind)', async () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    const copy = screen.getByRole('button', { name: /copy embed snippet/i })
    fireEvent.click(copy)
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const snippet = writeText.mock.calls[0]?.[0] as string
    expect(snippet).toContain('https://api.example/v1/public/surveys/srv_abc/widget.js')
    expect(snippet).toContain('data-survey="srv_abc"')
    expect(snippet).toContain('data-prefill-email="{{MEMBER_EMAIL}}"')
    expect(snippet).toContain('data-prefill-first-name="{{FIRST_NAME}}"')
    expect(snippet).toContain('data-prefill-last-name="{{LAST_NAME}}"')
    expect(snippet).not.toContain('data-prefill-phone')
    expect(snippet).not.toContain('data-prefill-external-id')
  })

  it('uses data-prefill-phone when memberIdentifierKind is phone', async () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="phone"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy embed snippet/i }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const snippet = writeText.mock.calls[0]?.[0] as string
    expect(snippet).toContain('data-prefill-phone="{{MEMBER_PHONE}}"')
    expect(snippet).not.toContain('data-prefill-email')
  })

  it('uses data-prefill-external-id when memberIdentifierKind is external_id', async () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="external_id"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy embed snippet/i }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const snippet = writeText.mock.calls[0]?.[0] as string
    expect(snippet).toContain('data-prefill-external-id="{{MEMBER_EXTERNAL_ID}}"')
    expect(snippet).not.toContain('data-prefill-email')
  })

  it('shows DRAFT banner above tiles when status === DRAFT (R33)', () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="DRAFT"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Survey is in DRAFT/i)
  })

  it('omits the DRAFT banner for non-DRAFT statuses', () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not render email integration or QR code tiles (removed in round-2 feedback)', () => {
    render(
      <DistributionSection
        surveyId="srv_abc"
        status="ACTIVE"
        responsesCount={0}
        apiUrl="https://api.example"
        memberIdentifierKind="email"
      />,
    )
    expect(screen.queryByText(/email integration/i)).toBeNull()
    expect(screen.queryByText(/qr code/i)).toBeNull()
    expect(screen.queryByText(/coming soon/i)).toBeNull()
  })
})
