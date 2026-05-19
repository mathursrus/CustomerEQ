// Issue #241 Slice 4b (#336) — BasicsTab RTL.
//
// Coverage per spec §2.1 / R6 / R7 / R8 / R30:
//   - Required-field validation: Internal name (Survey.name), Survey title
//     (Survey.title, respondent-facing — added in Slice 1).
//   - Type card-grid renders 4 cards (NPS · CSAT · CES · Custom).
//   - R6 type-change confirmation modal fires when questions exist AND the
//     operator switches to a different preset. Switching to Custom never
//     fires the modal.
//   - Program selector: with 1 program → defaults to it (no select needed).
//     With multiple → requires explicit selection per
//     project_241_slice4_program_selection.md.
//   - Embeds <ConsentCollectionSubBlock> (presence assertion — the sub-block's
//     own behavior is covered by ConsentCollectionSubBlock.test.tsx).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { BasicsTab } from './BasicsTab'
import {
  MOCK_BRAND_EXPLICIT,
  MOCK_DRAFT_SURVEY,
  MOCK_PROGRAM_NPS_WITH_RULE,
  MOCK_PROGRAM_CSAT_NO_RULE,
} from '../__fixtures__/editor-fixtures'

const NOOP_FIELD = () => {}

function renderTab(opts: {
  survey?: typeof MOCK_DRAFT_SURVEY
  programs?: typeof MOCK_PROGRAM_NPS_WITH_RULE[]
  onTypeChange?: (next: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM') => void
} = {}) {
  return render(
    <BasicsTab
      survey={opts.survey ?? MOCK_DRAFT_SURVEY}
      brand={MOCK_BRAND_EXPLICIT}
      programs={opts.programs ?? [MOCK_PROGRAM_NPS_WITH_RULE]}
      onFieldChange={NOOP_FIELD}
      onTypeChange={opts.onTypeChange ?? NOOP_FIELD}
      disabled={false}
    />,
  )
}

describe('<BasicsTab>', () => {
  describe('required-field validation', () => {
    it('Internal name is marked required (aria-required)', () => {
      renderTab()
      const input = screen.getByLabelText(/internal name/i)
      expect(input).toHaveAttribute('aria-required', 'true')
    })

    it('Survey title (respondent-facing) is marked required', () => {
      renderTab()
      const input = screen.getByLabelText(/survey title/i)
      expect(input).toHaveAttribute('aria-required', 'true')
    })

    it('surfaces inline error copy when Internal name is blurred empty', async () => {
      renderTab()
      const input = screen.getByLabelText(/internal name/i)
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)
      expect(await screen.findByText(/internal name is required/i)).toBeInTheDocument()
    })
  })

  describe('Type card-grid (R6)', () => {
    it('renders four type cards in the canonical order: NPS · CSAT · CES · Custom', () => {
      renderTab()
      const cards = screen.getAllByRole('radio')
      // The card-grid is a radiogroup with one radio per type.
      expect(cards.map((c) => c.getAttribute('value'))).toEqual(['NPS', 'CSAT', 'CES', 'CUSTOM'])
    })

    it('marks the survey.type as the selected card on mount', () => {
      renderTab() // MOCK_DRAFT_SURVEY.type === 'NPS'
      expect(screen.getByRole('radio', { name: /NPS/i })).toBeChecked()
    })

    it('R6: switching preset → preset confirmation modal opens when questions exist', () => {
      const onTypeChange = vi.fn()
      renderTab({ onTypeChange })
      fireEvent.click(screen.getByRole('radio', { name: /CSAT/i }))
      // Modal opens — no commit yet.
      expect(screen.getByRole('dialog', { name: /change survey type/i })).toBeInTheDocument()
      expect(onTypeChange).not.toHaveBeenCalled()
      // Confirm commits.
      fireEvent.click(screen.getByRole('button', { name: /change type/i }))
      expect(onTypeChange).toHaveBeenCalledWith('CSAT')
    })

    // Issue #336 Phase 12 V1-013 — Custom is no longer a silent "keep" of the
    // current question set. The mock §241 line 600 defines Custom as "Blank
    // canvas", so picking Custom now swaps the question set the same way
    // NPS / CSAT / CES presets do: silently when the current questions
    // match the current type's preset (or are empty), and behind the R6
    // modal when the operator has customized questions that would be lost.
    it('R6: switching to Custom with empty questions silently swaps (no modal)', () => {
      const onTypeChange = vi.fn()
      renderTab({
        onTypeChange,
        survey: { ...MOCK_DRAFT_SURVEY, questions: [] },
      })
      fireEvent.click(screen.getByRole('radio', { name: /custom/i }))
      expect(screen.queryByRole('dialog', { name: /change survey type/i })).not.toBeInTheDocument()
      expect(onTypeChange).toHaveBeenCalledWith('CUSTOM')
    })

    it('R6: switching to Custom with customized questions opens the confirmation modal', () => {
      const onTypeChange = vi.fn()
      // MOCK_DRAFT_SURVEY ships a single seed question that does NOT match
      // the canonical NPS preset (which has 2 questions per
      // _helpers/presets.ts). isUnchangedPreset returns false → modal opens.
      renderTab({ onTypeChange })
      fireEvent.click(screen.getByRole('radio', { name: /custom/i }))
      expect(screen.getByRole('dialog', { name: /change survey type/i })).toBeInTheDocument()
      expect(onTypeChange).not.toHaveBeenCalled()
      // Confirming the modal commits the type swap.
      fireEvent.click(screen.getByRole('button', { name: /change type/i }))
      expect(onTypeChange).toHaveBeenCalledWith('CUSTOM')
    })

    it('Cancelling the R6 modal preserves the current type + question canvas', () => {
      const onTypeChange = vi.fn()
      renderTab({ onTypeChange })
      fireEvent.click(screen.getByRole('radio', { name: /CES/i }))
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onTypeChange).not.toHaveBeenCalled()
      // The NPS card stays selected.
      expect(screen.getByRole('radio', { name: /NPS/i })).toBeChecked()
    })
  })

  describe('Program selector', () => {
    it('one program → renders the program name (no select control needed)', () => {
      renderTab({ programs: [MOCK_PROGRAM_NPS_WITH_RULE] })
      expect(screen.getByText(MOCK_PROGRAM_NPS_WITH_RULE.name)).toBeInTheDocument()
      // No select element to choose between — single-program shortcut.
      expect(screen.queryByRole('combobox', { name: /program/i })).not.toBeInTheDocument()
    })

    it('multiple programs → renders a select control requiring explicit choice', () => {
      renderTab({ programs: [MOCK_PROGRAM_NPS_WITH_RULE, MOCK_PROGRAM_CSAT_NO_RULE] })
      const select = screen.getByRole('combobox', { name: /program/i })
      expect(select).toBeInTheDocument()
      // Both options listed.
      expect(screen.getByRole('option', { name: MOCK_PROGRAM_NPS_WITH_RULE.name })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: MOCK_PROGRAM_CSAT_NO_RULE.name })).toBeInTheDocument()
    })
  })

  describe('embedded ConsentCollectionSubBlock', () => {
    it('renders the sub-block (full behavior covered by ConsentCollectionSubBlock.test.tsx)', () => {
      renderTab()
      expect(screen.getByTestId('consent-collection-subblock')).toBeInTheDocument()
    })
  })

  describe('disabled mode (STOPPED state)', () => {
    it('all inputs disabled when disabled=true', () => {
      render(
        <BasicsTab
          survey={MOCK_DRAFT_SURVEY}
          brand={MOCK_BRAND_EXPLICIT}
          programs={[MOCK_PROGRAM_NPS_WITH_RULE]}
          onFieldChange={NOOP_FIELD}
          onTypeChange={NOOP_FIELD}
          disabled
        />,
      )
      expect(screen.getByLabelText(/internal name/i)).toBeDisabled()
      expect(screen.getByLabelText(/survey title/i)).toBeDisabled()
    })
  })
})
