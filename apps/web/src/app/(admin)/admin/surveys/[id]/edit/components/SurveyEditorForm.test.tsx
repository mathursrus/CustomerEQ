// Issue #241 Slice 4b (#336) — SurveyEditorForm RTL.
//
// Validates the RHF top-level form's two main responsibilities:
//   - Per-tab dirty state via TAB_FIELDS (mirrors OrganizationSettingsForm's
//     SECTION_FIELDS pattern at apps/.../OrganizationSettingsForm.tsx:174-177).
//   - State-aware save mode (RFC §"Save behavior by state"):
//       DRAFT          → autosave on blur, no explicit Save button.
//       ACTIVE/PAUSED  → explicit Save button rendered per tab; only enabled
//                        when isTabDirty(currentTab).
//       STOPPED        → all inputs disabled, no Save button.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { SurveyEditorForm } from './SurveyEditorForm'
import {
  MOCK_ACTIVE_SURVEY,
  MOCK_BRAND_EXPLICIT,
  MOCK_DRAFT_SURVEY,
  MOCK_PROGRAM_NPS_WITH_RULE,
  MOCK_STOPPED_SURVEY,
  MOCK_THEME_LIBRARY,
} from '../__fixtures__/editor-fixtures'

// Stable references at module level — Slice 4a Lesson 2 (reference-instability
// causing infinite render loops when consumers depend on hook return objects).
const STABLE_PATCH = vi.fn(async () => new Response(null, { status: 200 }))
const STABLE_DISCARD = vi.fn(async () => new Response(null, { status: 204 }))
const STABLE_ACTIVATE = vi.fn(async () => new Response(null, { status: 200 }))

function renderForm(opts: { survey?: typeof MOCK_DRAFT_SURVEY; tab?: string } = {}) {
  return render(
    <SurveyEditorForm
      survey={opts.survey ?? MOCK_DRAFT_SURVEY}
      brand={MOCK_BRAND_EXPLICIT}
      themes={MOCK_THEME_LIBRARY}
      programs={[MOCK_PROGRAM_NPS_WITH_RULE]}
      initialTab={opts.tab ?? 'basics'}
      patchSurvey={STABLE_PATCH}
      deleteSurvey={STABLE_DISCARD}
      activateSurvey={STABLE_ACTIVATE}
    />,
  )
}

describe('<SurveyEditorForm>', () => {
  describe('per-tab dirty state', () => {
    it('starts clean — no tab reports dirty before any edit', () => {
      renderForm()
      // Tab nav exposes data-tab-dirty="false" per tab so isTabDirty() is
      // observable from the test surface without spying on react-hook-form
      // internals directly.
      expect(screen.getByRole('tab', { name: /basics/i })).toHaveAttribute('data-tab-dirty', 'false')
      expect(screen.getByRole('tab', { name: /questions/i })).toHaveAttribute('data-tab-dirty', 'false')
      expect(screen.getByRole('tab', { name: /look ?& ?feel/i })).toHaveAttribute('data-tab-dirty', 'false')
      expect(screen.getByRole('tab', { name: /points ?& ?thank you/i })).toHaveAttribute('data-tab-dirty', 'false')
    })

    it('flips isTabDirty("basics") to true when the Internal name field is edited', () => {
      renderForm()
      const input = screen.getByLabelText(/internal name/i)
      fireEvent.change(input, { target: { value: 'NPS Q3 launch' } })
      expect(screen.getByRole('tab', { name: /basics/i })).toHaveAttribute('data-tab-dirty', 'true')
      expect(screen.getByRole('tab', { name: /questions/i })).toHaveAttribute('data-tab-dirty', 'false')
    })

    it('flips isTabDirty("points-thank-you") independently of Basics', () => {
      renderForm({ tab: 'points-thank-you' })
      const input = screen.getByLabelText(/thank.?you message/i)
      fireEvent.change(input, { target: { value: 'Cheers — you earned points!' } })
      expect(screen.getByRole('tab', { name: /points ?& ?thank you/i })).toHaveAttribute(
        'data-tab-dirty',
        'true',
      )
      expect(screen.getByRole('tab', { name: /basics/i })).toHaveAttribute('data-tab-dirty', 'false')
    })
  })

  describe('state-aware save mode', () => {
    it('DRAFT: no explicit Save button rendered (auto-save indicator does the talking)', () => {
      renderForm({ survey: MOCK_DRAFT_SURVEY })
      // No "Save changes" button.
      expect(screen.queryByRole('button', { name: /^save changes$/i })).not.toBeInTheDocument()
      // Auto-save indicator IS rendered.
      expect(screen.getByTestId('autosave-indicator')).toBeInTheDocument()
    })

    it('ACTIVE: renders an explicit Save button per tab; disabled until the tab is dirty', () => {
      renderForm({ survey: MOCK_ACTIVE_SURVEY })
      const saveBtn = screen.getByRole('button', { name: /^save changes$/i })
      expect(saveBtn).toBeDisabled()
      // Make Basics dirty.
      fireEvent.change(screen.getByLabelText(/internal name/i), {
        target: { value: 'NPS Q2 — re-titled' },
      })
      expect(saveBtn).toBeEnabled()
    })

    it('ACTIVE: header banner explains live-edit semantics', () => {
      renderForm({ survey: MOCK_ACTIVE_SURVEY })
      expect(
        screen.getByText(/this survey is live\. changes apply immediately on save/i),
      ).toBeInTheDocument()
    })

    it('STOPPED: all inputs disabled and no Save button (R29: read-only mode)', () => {
      renderForm({ survey: MOCK_STOPPED_SURVEY })
      const tabPanel = screen.getByRole('tabpanel')
      const inputs = within(tabPanel).getAllByRole('textbox')
      expect(inputs.length).toBeGreaterThan(0)
      for (const input of inputs) expect(input).toBeDisabled()
      expect(screen.queryByRole('button', { name: /^save changes$/i })).not.toBeInTheDocument()
      expect(screen.getByText(/stopped — restart to edit/i)).toBeInTheDocument()
    })
  })

  describe('save delegation', () => {
    it('ACTIVE: clicking Save calls patchSurvey only with the dirty tab fields', async () => {
      renderForm({ survey: MOCK_ACTIVE_SURVEY })
      fireEvent.change(screen.getByLabelText(/internal name/i), {
        target: { value: 'NPS Q2 — re-titled' },
      })
      fireEvent.click(screen.getByRole('button', { name: /^save changes$/i }))
      // Allow the click handler microtask to settle.
      await screen.findByRole('button', { name: /^save changes$/i })
      expect(STABLE_PATCH).toHaveBeenCalled()
      const [, body] = STABLE_PATCH.mock.calls.at(-1) ?? []
      expect(body).toEqual(expect.objectContaining({ name: 'NPS Q2 — re-titled' }))
      // Unedited fields must NOT appear in the patch body (per-section semantics
      // mirroring OrganizationSettingsForm.handleSaveSection).
      expect(body).not.toHaveProperty('thankYouMessage')
    })
  })
})
