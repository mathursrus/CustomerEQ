// Issue #241 Slice 4b (#336) — PointsAndThankYouTab RTL.
//
// Coverage per spec §2.4 / R20 / R21:
//   - Read-only program-rate display sourced from
//     EarningRule(programId, cxEventForType) — operators cannot edit points
//     here (V0 has no per-survey points override).
//   - "No points configured for <type>" fallback when no rule matches.
//   - Thank-you variable picker offers EXACTLY 3 chips: {{points}},
//     {{pointCurrencyName}}, {{rewardLink}} — R21.
//   - Thank-you redirect URL is only relevant in the standalone channel
//     (operator chrome is the same UI in both — but a hint that this field
//     only matters for standalone is acceptable). The work-list spec implies
//     the input is always rendered; the test pins down the input exists in
//     DRAFT and accepts a URL.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { PointsAndThankYouTab } from './PointsAndThankYouTab'
import {
  MOCK_DRAFT_SURVEY,
  MOCK_PROGRAM_CSAT_NO_RULE,
  MOCK_PROGRAM_NPS_WITH_RULE,
} from '../__fixtures__/editor-fixtures'

const NOOP = () => {}

function renderTab(opts: {
  program?: typeof MOCK_PROGRAM_NPS_WITH_RULE
  survey?: typeof MOCK_DRAFT_SURVEY
  onChange?: (patch: { thankYouMessage?: string; thankYouRedirectUrl?: string | null }) => void
} = {}) {
  return render(
    <PointsAndThankYouTab
      survey={opts.survey ?? MOCK_DRAFT_SURVEY}
      program={opts.program ?? MOCK_PROGRAM_NPS_WITH_RULE}
      onChange={opts.onChange ?? NOOP}
      disabled={false}
    />,
  )
}

describe('<PointsAndThankYouTab>', () => {
  describe('R20 read-only program-rate display', () => {
    it('shows the points value for the surveyType cxEvent', () => {
      renderTab() // survey.type=NPS, program has cxEventForType=NPS rule
      expect(screen.getByTestId('program-rate-display')).toHaveTextContent(/25.*beans/i)
    })

    it('rate display is NOT editable (no input, no edit button)', () => {
      renderTab()
      const display = screen.getByTestId('program-rate-display')
      // No editable child elements.
      expect(display.querySelector('input')).toBeNull()
      expect(display.querySelector('button')).toBeNull()
    })

    it('"No points configured for <type>" fallback when no EarningRule matches', () => {
      renderTab({
        survey: { ...MOCK_DRAFT_SURVEY, type: 'CSAT' },
        program: MOCK_PROGRAM_CSAT_NO_RULE,
      })
      expect(screen.getByTestId('program-rate-display')).toHaveTextContent(
        /no points configured for csat/i,
      )
    })

    it('reserves layout slot for the V1 per-survey points override (R20 — slot only, no UI)', () => {
      renderTab()
      // The reserved-slot marker is in the DOM but renders nothing user-visible.
      // Asserting on the slot's presence (data-testid) lets §6 verify the reservation
      // without committing to specific copy.
      const slot = screen.getByTestId('points-override-slot')
      expect(slot).toBeInTheDocument()
      expect(slot).toBeEmptyDOMElement()
    })
  })

  describe('R21 thank-you variable picker', () => {
    it('renders exactly three variable chips: points / pointCurrencyName / rewardLink', () => {
      renderTab()
      const picker = screen.getByTestId('thank-you-variable-picker')
      const chips = picker.querySelectorAll('[data-variable]')
      const keys = Array.from(chips).map((c) => c.getAttribute('data-variable'))
      expect(keys).toEqual(['points', 'pointCurrencyName', 'rewardLink'])
    })

    it('clicking a chip inserts the variable token into the thank-you textarea', () => {
      const onChange = vi.fn()
      renderTab({ onChange })
      fireEvent.click(screen.getByTestId('variable-chip-points'))
      const patch = onChange.mock.calls.at(-1)?.[0]
      expect(patch?.thankYouMessage).toContain('{{points}}')
    })

    it('does NOT offer any other variable (no {{memberName}}, no {{brandName}})', () => {
      renderTab()
      const picker = screen.getByTestId('thank-you-variable-picker')
      expect(picker.querySelector('[data-variable="memberName"]')).toBeNull()
      expect(picker.querySelector('[data-variable="brandName"]')).toBeNull()
    })
  })

  describe('thank-you redirect URL', () => {
    it('renders an input for the redirect URL', () => {
      renderTab()
      expect(screen.getByLabelText(/thank.?you redirect url/i)).toBeInTheDocument()
    })

    it('emits onChange with the new URL when edited', () => {
      const onChange = vi.fn()
      renderTab({ onChange })
      fireEvent.change(screen.getByLabelText(/thank.?you redirect url/i), {
        target: { value: 'https://acme.test/done' },
      })
      const patch = onChange.mock.calls.at(-1)?.[0]
      expect(patch?.thankYouRedirectUrl).toBe('https://acme.test/done')
    })

    it('hints that the redirect URL is standalone-only (embedded ignores it)', () => {
      renderTab()
      // Hint copy lives next to the input — it is fine for both channels to
      // render the same control, but the operator needs to know the embed
      // widget won't honor it.
      expect(screen.getByText(/standalone/i)).toBeInTheDocument()
    })
  })

  describe('disabled mode (STOPPED)', () => {
    it('thank-you textarea + variable chips disabled when disabled=true', () => {
      render(
        <PointsAndThankYouTab
          survey={MOCK_DRAFT_SURVEY}
          program={MOCK_PROGRAM_NPS_WITH_RULE}
          onChange={NOOP}
          disabled
        />,
      )
      expect(screen.getByLabelText(/thank.?you message/i)).toBeDisabled()
      expect(screen.getByTestId('variable-chip-points')).toBeDisabled()
    })
  })
})
