import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmailPreviewCard } from './EmailPreviewCard'

// Spec R30a-d + mock #scene-3 lines 747-800 — live email preview pane.
// The preview substitutes mustache tokens against the sample recipient (R30b)
// and rerenders on every prop change (R30d).

beforeAll(() => {
  // jsdom 25 needs a window.location for the sample-link construction in the
  // preview card. Default to a deterministic origin so assertions can match.
  Object.defineProperty(window, 'location', {
    value: new URL('http://localhost:3000') as unknown as Location,
    writable: true,
  })
})

const baseProps = {
  senderName: 'Acme CX Team',
  senderAlias: 'feedback',
  senderDomain: 'customereq.wellnessatwork.me',
  subject: 'Quick question: Q2 2026 NPS',
  bodyHtml:
    '<p>{{brand_logo}}</p><p>{{brand_name}}</p><p>Hi {{first_name}},</p><p>We&rsquo;d love your feedback on {{survey_title}}. It takes about 2 minutes.</p><p>{{survey_link}}</p><p>Thanks,<br />{{sender_name}}</p>',
  sampleRecipient: {
    firstName: 'Alice',
    lastName: 'Chen',
    identifier: 'alice@artistos.com',
  },
  brandName: 'Acme Coffee',
  brandLogoUrl: 'https://cdn.example/acme-logo.png',
  surveyTitle: 'Q2 2026 NPS',
  surveyId: 'srv_q2nps',
}

describe('<EmailPreviewCard>', () => {
  it('substitutes mustache tokens against the sample recipient (R30b + R30c)', () => {
    render(<EmailPreviewCard {...baseProps} />)
    const body = screen.getByTestId('email-preview-body')
    expect(body).toHaveTextContent('Hi Alice,')
    expect(body).toHaveTextContent('We’d love your feedback on Q2 2026 NPS')
    expect(body).toHaveTextContent('Thanks,')
    // {{sender_name}} → "Acme CX Team"
    expect(body).toHaveTextContent('Acme CX Team')
  })

  it('renders the brand-logo header strip from Brand.logoUrl', () => {
    render(<EmailPreviewCard {...baseProps} />)
    const logo = screen.getByTestId('email-preview-brand-logo') as HTMLImageElement
    expect(logo.src).toBe('https://cdn.example/acme-logo.png')
    expect(logo.alt).toBe('Acme Coffee logo')
  })

  it('collapses brand header to brand-name only when Brand.logoUrl is null (R28 graceful degradation)', () => {
    render(<EmailPreviewCard {...baseProps} brandLogoUrl={null} />)
    expect(screen.queryByTestId('email-preview-brand-logo')).toBeNull()
    // Brand name still appears in the header strip (the strip just has no logo).
    const card = screen.getByTestId('email-preview-card')
    expect(card).toHaveTextContent('Acme Coffee')
  })

  it('shows "<recipient>" label in the header chip (mock line 748)', () => {
    render(<EmailPreviewCard {...baseProps} />)
    const recipient = screen.getByTestId('email-preview-recipient')
    expect(recipient).toHaveTextContent('Alice Chen')
  })

  it('falls back to placeholder recipient + "No audience selected" badge when sampleRecipient is null', () => {
    render(<EmailPreviewCard {...baseProps} sampleRecipient={null} />)
    expect(screen.getByTestId('email-preview-recipient')).toHaveTextContent('Sample Recipient')
    expect(screen.getByTestId('email-preview-no-audience')).toBeInTheDocument()
    // Body still renders with placeholder substitutions ("Hi Sample,").
    expect(screen.getByTestId('email-preview-body')).toHaveTextContent('Hi Sample,')
  })

  it('renders the From + To meta block with the sender domain', () => {
    const { container } = render(<EmailPreviewCard {...baseProps} />)
    expect(container.textContent).toContain('Acme CX Team')
    expect(container.textContent).toContain('feedback@customereq.wellnessatwork.me')
    expect(container.textContent).toContain('alice@artistos.com')
  })

  it('renders subject + substitutes a realistic {{survey_link}} sample URL', () => {
    render(<EmailPreviewCard {...baseProps} />)
    expect(screen.getByTestId('email-preview-subject')).toHaveTextContent(
      'Quick question: Q2 2026 NPS',
    )
    const body = screen.getByTestId('email-preview-body')
    // Sample link shape per R30c: /survey/<surveyId>/r/<sample-token>.
    expect(body.innerHTML).toContain('/survey/srv_q2nps/r/sample-token-')
  })

  it('renders the auto-appended unsubscribe footer (R30 + mock lines 740-744)', () => {
    render(<EmailPreviewCard {...baseProps} />)
    const footer = screen.getByTestId('email-preview-footer')
    expect(footer).toHaveTextContent(
      /You.?re a customer or partner of Acme Coffee/i,
    )
    expect(footer).toHaveTextContent(/Unsubscribe/i)
  })

  it('HTML-escapes substituted values so a member name with angle-brackets cannot inject HTML', () => {
    const malicious = {
      firstName: '<script>alert(1)</script>',
      lastName: null,
      identifier: 'evil@example.com',
    }
    render(<EmailPreviewCard {...baseProps} sampleRecipient={malicious} />)
    const body = screen.getByTestId('email-preview-body')
    // The <script> tag is rendered as escaped text, never as a live element.
    expect(body.querySelector('script')).toBeNull()
    expect(body.innerHTML).toContain('&lt;script&gt;')
  })
})
