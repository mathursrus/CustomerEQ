// Issue #241 Slice 4b (#336) — TabHeader RTL.
//
// Validates the 4-tab nav per spec §2 / R3 / R5:
//   - Tab order: Basics → Questions → Look & Feel → Points & Thank You.
//     Rules tab is intentionally absent (D14 — Rules deferred to a future slice).
//   - Activate button persistent across all tabs (R5).
//   - Auto-save indicator copy varies by survey status (R29):
//       DRAFT          → "Saved · Xs ago" / "Saving…" / "Draft" (initial).
//       ACTIVE/PAUSED  → "Unsaved in <tab>" when dirty (text per RFC).
//       STOPPED        → "Stopped — Restart to edit".

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { TabHeader } from './TabHeader'

const NOOP = () => {}

describe('<TabHeader>', () => {
  it('renders exactly four tabs in the spec order (R3): Basics → Questions → Look & Feel → Points & Thank You', () => {
    render(
      <TabHeader
        activeTab="basics"
        onTabChange={NOOP}
        surveyStatus="DRAFT"
        savedAt={null}
        isAnyTabDirty={false}
        onActivate={NOOP}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Basics',
      'Questions',
      'Look & Feel',
      'Points & Thank You',
    ])
    // Rules tab is hidden entirely (D14).
    expect(screen.queryByRole('tab', { name: /rules/i })).not.toBeInTheDocument()
  })

  it('clicking a tab invokes onTabChange with the new tab id', () => {
    const onTabChange = vi.fn()
    render(
      <TabHeader
        activeTab="basics"
        onTabChange={onTabChange}
        surveyStatus="DRAFT"
        savedAt={null}
        isAnyTabDirty={false}
        onActivate={NOOP}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Questions' }))
    expect(onTabChange).toHaveBeenCalledWith('questions')
    fireEvent.click(screen.getByRole('tab', { name: 'Look & Feel' }))
    expect(onTabChange).toHaveBeenLastCalledWith('look-feel')
    fireEvent.click(screen.getByRole('tab', { name: 'Points & Thank You' }))
    expect(onTabChange).toHaveBeenLastCalledWith('points-thank-you')
  })

  it('marks the active tab with aria-selected="true"', () => {
    render(
      <TabHeader
        activeTab="look-feel"
        onTabChange={NOOP}
        surveyStatus="DRAFT"
        savedAt={null}
        isAnyTabDirty={false}
        onActivate={NOOP}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Look & Feel' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Basics' })).toHaveAttribute('aria-selected', 'false')
  })

  describe('auto-save indicator copy by survey status', () => {
    it('DRAFT + no savedAt → "Draft" (initial state, never edited)', () => {
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="DRAFT"
          savedAt={null}
          isAnyTabDirty={false}
          onActivate={NOOP}
        />,
      )
      expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(/draft/i)
    })

    it('DRAFT + savedAt within the last 60s → "Saved · just now" or similar relative-time copy', () => {
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString()
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="DRAFT"
          savedAt={tenSecondsAgo}
          isAnyTabDirty={false}
          onActivate={NOOP}
        />,
      )
      expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(/saved/i)
    })

    it('ACTIVE + dirty → "Unsaved in <tab>" (RFC §Save behavior by state)', () => {
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="ACTIVE"
          savedAt={null}
          isAnyTabDirty
          onActivate={NOOP}
        />,
      )
      expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(/unsaved/i)
    })

    it('STOPPED → "Stopped — Restart to edit" (R29 read-only mode)', () => {
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="STOPPED"
          savedAt={null}
          isAnyTabDirty={false}
          onActivate={NOOP}
        />,
      )
      expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(/stopped — restart to edit/i)
    })
  })

  describe('Activate button', () => {
    it('renders the Activate CTA across all tabs in DRAFT (R5 persistent across tabs)', () => {
      const tabs = ['basics', 'questions', 'look-feel', 'points-thank-you'] as const
      for (const tab of tabs) {
        const { unmount } = render(
          <TabHeader
            activeTab={tab}
            onTabChange={NOOP}
            surveyStatus="DRAFT"
            savedAt={null}
            isAnyTabDirty={false}
            onActivate={NOOP}
          />,
        )
        expect(screen.getByRole('button', { name: /^activate$/i })).toBeInTheDocument()
        unmount()
      }
    })

    it('clicking Activate calls onActivate (parent opens <ActivateModal>)', () => {
      const onActivate = vi.fn()
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="DRAFT"
          savedAt={null}
          isAnyTabDirty={false}
          onActivate={onActivate}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /^activate$/i }))
      expect(onActivate).toHaveBeenCalledOnce()
    })

    it('STOPPED: Activate button is disabled (R29 — operator must Restart from detail page first)', () => {
      render(
        <TabHeader
          activeTab="basics"
          onTabChange={NOOP}
          surveyStatus="STOPPED"
          savedAt={null}
          isAnyTabDirty={false}
          onActivate={NOOP}
        />,
      )
      expect(screen.getByRole('button', { name: /^activate$/i })).toBeDisabled()
    })
  })
})
