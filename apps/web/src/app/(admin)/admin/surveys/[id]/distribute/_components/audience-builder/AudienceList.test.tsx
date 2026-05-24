// Issue #420 — AudienceList tests: status chip rendering, suppressed-row
// disabled checkbox enforcement (R22), bulk-select-page semantics (R23),
// and pagination (R20).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { AudienceList } from './AudienceList'
import type { AudienceRow } from './types'

const mk = (overrides: Partial<AudienceRow>): AudienceRow => ({
  memberId: 'm-' + Math.random().toString(36).slice(2),
  identifier: 'someone@example.com',
  email: 'someone@example.com',
  firstName: 'A',
  lastName: 'Person',
  lastResponseThisSurvey: null,
  lastResponseAnySurvey: null,
  source: 'EXISTING_SEARCH',
  willAutoEnroll: false,
  suppressionStatus: 'OK',
  suppressionSince: null,
  selected: true,
  ...overrides,
})

describe('<AudienceList>', () => {
  it('renders the empty-state copy when no rows', () => {
    render(
      <AudienceList
        rows={[]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    expect(screen.getByText(/no members added yet/i)).toBeInTheDocument()
  })

  it('summarises selected + auto-enroll + deselected + suppressed counts', () => {
    render(
      <AudienceList
        rows={[
          mk({ memberId: '1', firstName: 'Alice', selected: true }),
          mk({ memberId: '2', firstName: 'Bob', selected: true }),
          mk({ memberId: '3', firstName: 'Carla', selected: false }),
          mk({
            memberId: '4',
            firstName: 'Hannah',
            suppressionStatus: 'UNSUBSCRIBED',
            suppressionSince: '2026-04-12T00:00:00.000Z',
            selected: false,
          }),
          mk({
            memberId: null,
            identifier: 'new@example.com',
            firstName: 'Eric',
            willAutoEnroll: true,
            selected: true,
          }),
        ]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    expect(screen.getByText(/5 members in this wave/i)).toBeInTheDocument()
    expect(screen.getByText(/3 selected/)).toBeInTheDocument()
    expect(screen.getByText(/1 will auto-enroll/)).toBeInTheDocument()
    expect(screen.getByText(/1 deselected/)).toBeInTheDocument()
    expect(screen.getByText(/1 suppressed/)).toBeInTheDocument()
  })

  it('disables the checkbox for suppressed rows (R22)', () => {
    render(
      <AudienceList
        rows={[
          mk({ memberId: '1', firstName: 'Alice' }),
          mk({
            memberId: '2',
            firstName: 'Hannah',
            suppressionStatus: 'UNSUBSCRIBED',
            suppressionSince: '2026-04-12T00:00:00.000Z',
            selected: false,
          }),
        ]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    const hannahCheckbox = screen.getByRole('checkbox', { name: /select Hannah Person/i })
    expect(hannahCheckbox).toBeDisabled()
    expect(hannahCheckbox).not.toBeChecked()
    expect(screen.getByText(/Unsubscribed · 2026-04-12/)).toBeInTheDocument()
  })

  it('toggles a selected row when clicked', () => {
    const onToggleRow = vi.fn()
    render(
      <AudienceList
        rows={[mk({ memberId: 'm1', firstName: 'Alice', selected: true })]}
        onToggleRow={onToggleRow}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select Alice Person/i }))
    expect(onToggleRow).toHaveBeenCalledWith('m1')
  })

  it('emits onBulkSelectPage for "Select all on page"', () => {
    const onBulkSelectPage = vi.fn()
    render(
      <AudienceList
        rows={[
          mk({ memberId: 'a', firstName: 'Alice', selected: false }),
          mk({ memberId: 'b', firstName: 'Bob', selected: false }),
          mk({
            memberId: 'h',
            firstName: 'Hannah',
            suppressionStatus: 'UNSUBSCRIBED',
            selected: false,
          }),
        ]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={onBulkSelectPage}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^select all on page$/i }))
    expect(onBulkSelectPage).toHaveBeenCalledWith(['a', 'b'], true)
  })

  it('emits onRemoveUnchecked for "Remove all unchecked"', () => {
    const onRemoveUnchecked = vi.fn()
    render(
      <AudienceList
        rows={[
          mk({ memberId: 'a', firstName: 'Alice', selected: true }),
          mk({ memberId: 'b', firstName: 'Bob', selected: false }),
        ]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={onRemoveUnchecked}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^remove all unchecked$/i }))
    expect(onRemoveUnchecked).toHaveBeenCalled()
  })

  it('paginates at 25 rows by default and exposes a page-size selector', () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      mk({ memberId: `m${i}`, firstName: `Name${i}` }),
    )
    render(
      <AudienceList
        rows={rows}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    // 25 rows on page 1
    const table = screen.getByRole('table')
    const dataRows = within(table).getAllByRole('row').slice(1) // skip header
    expect(dataRows).toHaveLength(25)
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()

    // bumping to 50/page should fit all 30 rows on one page
    fireEvent.change(screen.getByLabelText(/page size/i), { target: { value: '50' } })
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument()
  })

  it('renders the New (auto-enroll) source chip for would-be-new members', () => {
    render(
      <AudienceList
        rows={[
          mk({
            memberId: null,
            identifier: 'new@example.com',
            firstName: 'Eric',
            willAutoEnroll: true,
            source: 'CUSTOM_LIST',
          }),
        ]}
        onToggleRow={vi.fn()}
        onBulkSelectPage={vi.fn()}
        onRemoveUnchecked={vi.fn()}
      />,
    )
    expect(screen.getByText(/New \(auto-enroll\)/i)).toBeInTheDocument()
  })
})
