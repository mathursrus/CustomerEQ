// Issue #241 Slice 4b (#336) — QuestionsTab RTL.
//
// Coverage per spec §2.2 / R6:
//   - Palette exposes 11 non-legacy question types (legacy 'choice' is hidden
//     in the operator UI — kept in the schema for back-compat per
//     packages/shared/src/zod/survey.schema.ts:5-10).
//   - Per-question right-rail config (text input, required toggle, skip logic).
//   - Up/Down reorder buttons mutate the questions array (no @dnd-kit dep —
//     §G anti-pattern).
//   - Preset banner copy renders when survey.type ∈ {NPS, CSAT, CES}; not for
//     CUSTOM.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import type { SurveyQuestion } from '@customerEQ/shared'
import { QuestionsTab } from './QuestionsTab'
import { MOCK_DRAFT_SURVEY, MOCK_ACTIVE_SURVEY } from '../__fixtures__/editor-fixtures'

const NOOP = () => {}

const PALETTE_ELEVEN = [
  'rating',
  'text',
  'multiple_choice',
  'checkbox',
  'dropdown',
  'matrix',
  'ranking',
  'slider',
  'likert',
  'image_choice',
  'file_upload',
]

function renderTab(opts: {
  questions?: SurveyQuestion[]
  type?: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  onChange?: (next: SurveyQuestion[]) => void
} = {}) {
  return render(
    <QuestionsTab
      survey={{
        ...MOCK_DRAFT_SURVEY,
        type: opts.type ?? 'NPS',
        questions: opts.questions ?? MOCK_DRAFT_SURVEY.questions,
      }}
      onChange={opts.onChange ?? NOOP}
      disabled={false}
    />,
  )
}

describe('<QuestionsTab>', () => {
  describe('palette', () => {
    it('exposes all 11 non-legacy question types', () => {
      renderTab()
      const palette = screen.getByTestId('question-palette')
      for (const t of PALETTE_ELEVEN) {
        expect(within(palette).getByTestId(`palette-type-${t}`)).toBeInTheDocument()
      }
    })

    it('does NOT expose the legacy "choice" type in the operator palette', () => {
      renderTab()
      const palette = screen.getByTestId('question-palette')
      expect(within(palette).queryByTestId('palette-type-choice')).not.toBeInTheDocument()
    })

    it('clicking a palette tile appends a new question of that type via onChange', () => {
      const onChange = vi.fn()
      renderTab({ onChange })
      fireEvent.click(screen.getByTestId('palette-type-text'))
      const next = onChange.mock.calls.at(-1)?.[0] as SurveyQuestion[]
      expect(next.at(-1)?.type).toBe('text')
      expect(next).toHaveLength((MOCK_DRAFT_SURVEY.questions?.length ?? 0) + 1)
    })
  })

  describe('per-question right-rail config', () => {
    it('shows the right-rail when a question is selected', () => {
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions })
      // Click the first question card to select it.
      fireEvent.click(screen.getAllByTestId(/^question-card-/)[0])
      expect(screen.getByTestId('question-config-panel')).toBeInTheDocument()
    })

    it('editing question text propagates via onChange', () => {
      const onChange = vi.fn()
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions, onChange })
      fireEvent.click(screen.getAllByTestId(/^question-card-/)[0])
      const textInput = screen.getByLabelText(/question text/i)
      fireEvent.change(textInput, { target: { value: 'How likely are you to recommend us today?' } })
      const next = onChange.mock.calls.at(-1)?.[0] as SurveyQuestion[]
      expect(next[0].text).toBe('How likely are you to recommend us today?')
    })

    it('toggling Required propagates via onChange', () => {
      const onChange = vi.fn()
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions, onChange })
      fireEvent.click(screen.getAllByTestId(/^question-card-/)[0])
      const requiredToggle = screen.getByLabelText(/required/i)
      fireEvent.click(requiredToggle)
      const next = onChange.mock.calls.at(-1)?.[0] as SurveyQuestion[]
      expect(next[0].required).toBe(!MOCK_ACTIVE_SURVEY.questions[0].required)
    })
  })

  describe('Up/Down reorder (no drag-drop)', () => {
    it('renders an Up and Down button on each question card', () => {
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions })
      const cards = screen.getAllByTestId(/^question-card-/)
      expect(cards).toHaveLength(2)
      for (const card of cards) {
        expect(within(card).getByRole('button', { name: /move up/i })).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: /move down/i })).toBeInTheDocument()
      }
    })

    it('clicking Down on the first question swaps it with the second', () => {
      const onChange = vi.fn()
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions, onChange })
      const firstCard = screen.getAllByTestId(/^question-card-/)[0]
      fireEvent.click(within(firstCard).getByRole('button', { name: /move down/i }))
      const next = onChange.mock.calls.at(-1)?.[0] as SurveyQuestion[]
      // The original first question moved to slot 1.
      expect(next[0].id).toBe(MOCK_ACTIVE_SURVEY.questions[1].id)
      expect(next[1].id).toBe(MOCK_ACTIVE_SURVEY.questions[0].id)
    })

    it('Up on the first question is disabled (no-op at top of list)', () => {
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions })
      const firstCard = screen.getAllByTestId(/^question-card-/)[0]
      expect(within(firstCard).getByRole('button', { name: /move up/i })).toBeDisabled()
    })

    it('Down on the last question is disabled', () => {
      renderTab({ questions: MOCK_ACTIVE_SURVEY.questions })
      const cards = screen.getAllByTestId(/^question-card-/)
      const lastCard = cards.at(-1)!
      expect(within(lastCard).getByRole('button', { name: /move down/i })).toBeDisabled()
    })
  })

  describe('preset banner (R6)', () => {
    it.each(['NPS', 'CSAT', 'CES'] as const)(
      'renders preset banner copy when survey.type=%s',
      (type) => {
        renderTab({ type })
        expect(screen.getByTestId('preset-banner')).toBeInTheDocument()
      },
    )

    it('CUSTOM: no preset banner (canvas is purely operator-defined)', () => {
      renderTab({ type: 'CUSTOM', questions: [] })
      expect(screen.queryByTestId('preset-banner')).not.toBeInTheDocument()
    })

    it('CUSTOM with zero questions renders an empty-state hint', () => {
      renderTab({ type: 'CUSTOM', questions: [] })
      expect(screen.getByTestId('questions-empty-state')).toBeInTheDocument()
    })
  })
})
