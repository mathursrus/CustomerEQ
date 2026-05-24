// G12 — ComposerSnapshotBlock now delegates rendering to EmailPreviewCard so
// the post-send snapshot reads as the same WYSIWYG view the operator saw at
// compose time. These tests cover the section-shell concerns + the props
// passed through. EmailPreviewCard has its own focused test suite.

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ComposerSnapshotBlock } from './ComposerSnapshotBlock'

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: new URL('http://localhost:3000') as unknown as Location,
    writable: true,
  })
})

const baseSnapshot = {
  senderName: 'Acme CX Team',
  senderAlias: 'feedback',
  senderDomain: 'cx.acme-via-customereq.io',
  subject: 'Quick question: Q2 NPS',
  body: '<p>{{brand_logo}}</p><p>{{brand_name}}</p><p>Hi {{first_name}}, please respond at {{survey_link}}.</p>',
  brandLogoUrl: 'https://cdn.acme.com/logo.png',
  brandName: 'Acme Coffee',
}

describe('<ComposerSnapshotBlock>', () => {
  it('renders the section shell with the heading + description', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} surveyId="srv_q2nps" />)
    const section = screen.getByTestId('composer-snapshot-block')
    expect(section).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Composer snapshot/i })).toBeInTheDocument()
  })

  it('delegates rendering to EmailPreviewCard and surfaces the snapshot brand identity via mustache substitution', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} surveyId="srv_q2nps" />)
    const preview = screen.getByTestId('email-preview-card')
    expect(preview).toBeInTheDocument()
    const body = screen.getByTestId('email-preview-body')
    // brand_logo substitutes inside the rendered body (G4/G12 — no always-on
    // brand header strip; mustache placement controls where it appears).
    const logo = body.querySelector('img[data-mustache="brand-logo"]') as HTMLImageElement | null
    expect(logo).not.toBeNull()
    expect(logo!.src).toBe('https://cdn.acme.com/logo.png')
    expect(body).toHaveTextContent('Acme Coffee')
  })

  it('forwards the snapshot theme colors to EmailPreviewCard when themeSnapshot is set', () => {
    render(
      <ComposerSnapshotBlock
        snapshot={{
          ...baseSnapshot,
          themeSnapshot: {
            primaryColor: '#ff00ff',
            secondaryColor: '#aabbcc',
            backgroundColor: '#ffffff',
            textColor: '#111827',
            accentColor: '#0000ff',
            buttonColor: '#00ff00',
            buttonTextColor: '#ffffff',
            fontFamily: 'Inter',
          },
        }}
        surveyId="srv_q2nps"
      />,
    )
    const body = screen.getByTestId('email-preview-body')
    const nameSpan = body.querySelector('[data-mustache="brand-name"]') as HTMLSpanElement | null
    expect(nameSpan).not.toBeNull()
    expect(nameSpan!.getAttribute('style')).toContain('#ff00ff')
  })
})
