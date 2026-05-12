import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponseSection } from './ResponseSection'

// Issue #241 Slice 4a — R32 inverse expand rule.
// Placeholder block in V0; real analytics ship under a sibling sub-issue.

describe('<ResponseSection>', () => {
  it('defaults collapsed when responsesCount === 0 (inverse of Distribution / Configuration)', () => {
    render(<ResponseSection responsesCount={0} />)
    expect(screen.queryByText(/Response analytics/i)).toBeNull()
  })

  it('defaults expanded when responsesCount > 0', () => {
    render(<ResponseSection responsesCount={10} />)
    expect(screen.getByText(/Response analytics/i)).toBeInTheDocument()
  })

  it('renders a placeholder block describing the future-state', () => {
    render(<ResponseSection responsesCount={1} />)
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
  })
})
