// Issue #241 Slice 4b (#336) — TabHeader RTL.
//
// Issue #336 Phase 12 V1-014 / V1-023 / V1-027 restructured the editor page:
// the auto-save indicator and the state-aware primary actions (Activate /
// Pause / Resume / Stop / Restart) moved up to the page header rendered
// inside `SurveyEditorForm`, and `TabHeader` is now strictly the numbered
// horizontal tab nav (mock §241 lines 64-72 / 548-553). Indicator and
// activate coverage that previously lived here is now exercised through
// `SurveyEditorForm.test.tsx` + the editor e2e suite at
// `apps/web/test/e2e/336-survey-editor.spec.ts`.
//
// What this file still owns:
//   - Tab order: Basics → Questions → Look & Feel → Points & Thank You.
//     Rules tab is intentionally absent (D14 — Rules deferred).
//   - Active-tab `aria-selected="true"` semantics.
//   - Click-through wiring to `onTabChange`.
//   - Numbered step indicator visibility (V1-014).

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
      />,
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    // The visible-text content includes the numbered step prefix (V1-014).
    // We match the trailing label per tab rather than asserting on the
    // exact "1Basics" / "2Questions" concatenation so the spec-order check
    // stays readable.
    expect(tabs.map((t) => t.textContent)).toEqual([
      '1Basics',
      '2Questions',
      '3Look & Feel',
      '4Points & Thank You',
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
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    expect(onTabChange).toHaveBeenCalledWith('questions')
    fireEvent.click(screen.getByRole('tab', { name: /Look & Feel/ }))
    expect(onTabChange).toHaveBeenLastCalledWith('look-feel')
    fireEvent.click(screen.getByRole('tab', { name: /Points & Thank You/ }))
    expect(onTabChange).toHaveBeenLastCalledWith('points-thank-you')
  })

  it('marks the active tab with aria-selected="true"', () => {
    render(
      <TabHeader
        activeTab="look-feel"
        onTabChange={NOOP}
      />,
    )
    expect(screen.getByRole('tab', { name: /Look & Feel/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Basics/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows a numbered step indicator (1..4) inside each tab button (V1-014)', () => {
    render(
      <TabHeader
        activeTab="basics"
        onTabChange={NOOP}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    // Step number is rendered as the leading aria-hidden glyph in each tab.
    expect(tabs[0].textContent).toMatch(/^1/)
    expect(tabs[1].textContent).toMatch(/^2/)
    expect(tabs[2].textContent).toMatch(/^3/)
    expect(tabs[3].textContent).toMatch(/^4/)
  })
})
