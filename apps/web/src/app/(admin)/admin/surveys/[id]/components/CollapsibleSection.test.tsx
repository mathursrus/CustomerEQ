import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollapsibleSection } from './CollapsibleSection'

// Issue #241 Slice 4a — R26 chevron-toggle primitive used by all 3 detail sections.

describe('<CollapsibleSection>', () => {
  it('renders the title', () => {
    render(
      <CollapsibleSection title="Distribution" expandedDefault>
        <div>body content</div>
      </CollapsibleSection>,
    )
    expect(screen.getByRole('heading', { name: 'Distribution' })).toBeInTheDocument()
  })

  it('renders the body when expandedDefault is true', () => {
    render(
      <CollapsibleSection title="Distribution" expandedDefault>
        <div>body content</div>
      </CollapsibleSection>,
    )
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('hides the body when expandedDefault is false', () => {
    render(
      <CollapsibleSection title="Response" expandedDefault={false}>
        <div>body content</div>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('body content')).toBeNull()
  })

  it('toggles open and closed on chevron click', async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Configuration summary" expandedDefault={false}>
        <div>body content</div>
      </CollapsibleSection>,
    )
    const toggle = screen.getByRole('button', { name: /configuration summary/i })
    await user.click(toggle)
    expect(screen.getByText('body content')).toBeInTheDocument()
    await user.click(toggle)
    expect(screen.queryByText('body content')).toBeNull()
  })

  it('exposes aria-expanded state on the toggle button', async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Response" expandedDefault>
        <div>body content</div>
      </CollapsibleSection>,
    )
    const toggle = screen.getByRole('button', { name: /response/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
