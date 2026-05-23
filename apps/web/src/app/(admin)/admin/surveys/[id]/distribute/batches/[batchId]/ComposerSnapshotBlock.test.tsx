import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ComposerSnapshotBlock } from './ComposerSnapshotBlock'

const baseSnapshot = {
  senderName: 'Acme CX Team',
  senderAlias: 'feedback',
  senderDomain: 'cx.acme-via-customereq.io',
  subject: 'Quick question: Q2 NPS',
  body: 'Hi {{first_name}},\nHow likely are you to recommend Acme?\n{{survey_link}}\nThanks!',
  brandLogoUrl: 'https://cdn.acme.com/logo.png',
  brandName: 'Acme Coffee',
}

describe('<ComposerSnapshotBlock>', () => {
  it('renders sender name + alias@domain', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} />)
    expect(screen.getByText('Acme CX Team')).toBeInTheDocument()
    expect(screen.getByTestId('composer-snapshot-from')).toHaveTextContent(
      'feedback@cx.acme-via-customereq.io',
    )
  })

  it('renders subject and body verbatim, preserving unresolved mustache tokens', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} />)
    expect(screen.getByTestId('composer-snapshot-subject')).toHaveTextContent(
      'Quick question: Q2 NPS',
    )
    const body = screen.getByTestId('composer-snapshot-body')
    expect(body.textContent).toContain('{{first_name}}')
    expect(body.textContent).toContain('{{survey_link}}')
    expect(body.textContent).toContain('Thanks!')
  })

  it('shows the brand logo when brandLogoUrl is set', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} />)
    const img = screen.getByTestId('composer-snapshot-brand-logo') as HTMLImageElement
    expect(img.src).toBe('https://cdn.acme.com/logo.png')
    expect(img.alt).toBe('Acme Coffee logo')
  })

  it('omits the brand logo when brandLogoUrl is null', () => {
    render(<ComposerSnapshotBlock snapshot={{ ...baseSnapshot, brandLogoUrl: null }} />)
    expect(screen.queryByTestId('composer-snapshot-brand-logo')).toBeNull()
    expect(screen.getByText('Acme Coffee')).toBeInTheDocument()
  })

  it('renders the body inside a <pre> so newlines and whitespace are preserved', () => {
    render(<ComposerSnapshotBlock snapshot={baseSnapshot} />)
    const body = screen.getByTestId('composer-snapshot-body')
    expect(body.tagName).toBe('PRE')
  })
})
