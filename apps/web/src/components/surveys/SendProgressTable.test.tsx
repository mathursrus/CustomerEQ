import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SendProgressStatusPill, SendProgressTable } from './SendProgressTable'

const baseRows = [
  {
    memberId: 'm_1',
    identifier: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Chen',
    status: 'sent' as const,
    deliveredAt: '2026-05-21T18:08:00.000Z',
    failedAt: null,
    failureReason: null,
  },
  {
    memberId: 'm_2',
    identifier: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Patel',
    status: 'failed' as const,
    deliveredAt: null,
    failedAt: '2026-05-21T18:10:00.000Z',
    failureReason: 'bounce',
  },
  {
    memberId: 'm_3',
    identifier: 'carla@example.com',
    firstName: null,
    lastName: null,
    status: 'queued' as const,
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
  },
]

describe('<SendProgressStatusPill>', () => {
  it.each(['queued', 'sending', 'sent', 'failed'] as const)('renders %s pill', (status) => {
    render(<SendProgressStatusPill status={status} />)
    expect(screen.getByTestId(`send-progress-status-${status}`)).toBeInTheDocument()
  })
})

describe('<SendProgressTable>', () => {
  it('renders one row per recipient with name, identifier, and status', () => {
    render(<SendProgressTable recipients={baseRows} />)
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('carla@example.com')).toBeInTheDocument()
    expect(screen.getAllByTestId(/send-progress-status-/)).toHaveLength(3)
  })

  it('shows the failure reason in the Detail column for failed rows', () => {
    render(<SendProgressTable recipients={baseRows} />)
    expect(screen.getByText('bounce')).toBeInTheDocument()
  })

  it('shows em-dash for queued rows with no deliveredAt', () => {
    render(<SendProgressTable recipients={[baseRows[2]]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('formats deliveredAt in the brand timezone when provided', () => {
    render(
      <SendProgressTable
        recipients={[baseRows[0]]}
        brandTimezone="America/Los_Angeles"
        brandLocale="en-US"
      />,
    )
    // 18:08 UTC on 2026-05-21 → 11:08 PT same day. Assert the zone marker
    // ("PT" / "PDT") is part of the formatted output.
    const detailCells = screen.getAllByRole('cell')
    const detailText = detailCells.map((c) => c.textContent ?? '').join(' ')
    expect(detailText).toMatch(/P[DS]T/)
  })

  it('falls back to locale time when no timezone is provided', () => {
    render(<SendProgressTable recipients={[baseRows[0]]} />)
    // No zone formatting — just the time portion. Sanity: not the em-dash.
    expect(screen.queryByText('—')).toBeNull()
  })
})
