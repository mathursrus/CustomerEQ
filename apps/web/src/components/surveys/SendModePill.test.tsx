import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SendModePill } from './SendModePill'

describe('<SendModePill>', () => {
  it('renders MANAGED_EMAIL with the "Sent via CustomerEQ" label and indigo styling', () => {
    render(<SendModePill mode="MANAGED_EMAIL" />)
    const pill = screen.getByTestId('send-mode-pill-MANAGED_EMAIL')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent('Sent via CustomerEQ')
    expect(pill.className).toMatch(/indigo/)
  })

  it('renders SELF_SERVE with the "Sent via my email tool" label and amber styling', () => {
    render(<SendModePill mode="SELF_SERVE" />)
    const pill = screen.getByTestId('send-mode-pill-SELF_SERVE')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent('Sent via my email tool')
    expect(pill.className).toMatch(/amber/)
  })

  it('honors the md size variant', () => {
    render(<SendModePill mode="MANAGED_EMAIL" size="md" />)
    const pill = screen.getByTestId('send-mode-pill-MANAGED_EMAIL')
    expect(pill.className).toMatch(/text-xs/)
    expect(pill.className).toMatch(/px-2/)
  })
})
