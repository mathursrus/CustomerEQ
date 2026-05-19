// Issue #241 Slice 4b (#336) — ActivateModal RTL.
//
// Coverage per spec §6 / R23:
//   - Pre-activate summary shows live values: question count, current consent
//     mode, theme name, response policy.
//   - Activate gates (R23): each gate failure surfaces an inline error per gate.
//       - ≥1 question
//       - Required fields complete (Internal name, Survey title)
//       - Consent override (if any) is attested
//   - Success path: clicking "Activate & go to detail" calls activateSurvey
//     (PATCH /v1/surveys/:id/status → ACTIVE) and triggers onActivated which
//     redirects parent to /admin/surveys/[id].

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ActivateModal } from './ActivateModal'
import {
  MOCK_BRAND_EXPLICIT,
  MOCK_DRAFT_SURVEY,
  MOCK_THEME_DEFAULT,
} from '../__fixtures__/editor-fixtures'

const NOOP = () => {}

function setup(opts: {
  open?: boolean
  survey?: typeof MOCK_DRAFT_SURVEY
  activateFn?: (id: string) => Promise<Response>
  onActivated?: () => void
} = {}) {
  const activateFn =
    opts.activateFn ?? vi.fn(async () => new Response(null, { status: 200 }))
  const onActivated = opts.onActivated ?? vi.fn()
  render(
    <ActivateModal
      open={opts.open ?? true}
      survey={opts.survey ?? { ...MOCK_DRAFT_SURVEY, title: 'Quick check-in' }}
      brand={MOCK_BRAND_EXPLICIT}
      theme={MOCK_THEME_DEFAULT}
      activateSurvey={activateFn}
      onActivated={onActivated}
      onClose={NOOP}
    />,
  )
  return { activateFn, onActivated }
}

describe('<ActivateModal>', () => {
  it('does not render when open=false', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('pre-activate summary', () => {
    it('shows the question count, theme, response policy, and consent mode', () => {
      setup({
        survey: {
          ...MOCK_DRAFT_SURVEY,
          title: 'Quick check-in',
          questions: [
            { id: 'q1', type: 'rating', text: 'Score?', required: true, config: { min: 0, max: 10 } },
            { id: 'q2', type: 'text', text: 'Why?', required: false, config: {} },
          ],
        },
      })
      const summary = screen.getByTestId('activate-summary')
      expect(summary).toHaveTextContent(/2 questions/i)
      expect(summary).toHaveTextContent(MOCK_THEME_DEFAULT.name)
      expect(summary).toHaveTextContent(/multiple/i) // responsePolicy=MULTIPLE
      expect(summary).toHaveTextContent(/explicit/i) // brand consent mode
    })
  })

  describe('R23 gates', () => {
    it('blocks Activate when the survey has zero questions', () => {
      setup({ survey: { ...MOCK_DRAFT_SURVEY, title: 'Has title', questions: [] } })
      const activateBtn = screen.getByRole('button', { name: /activate.*go to detail|^activate$/i })
      expect(activateBtn).toBeDisabled()
      expect(screen.getByText(/add at least one question/i)).toBeInTheDocument()
    })

    it('blocks Activate when Survey title is empty (required field per R7)', () => {
      setup({
        survey: {
          ...MOCK_DRAFT_SURVEY,
          title: null,
          questions: [
            { id: 'q1', type: 'rating', text: 'Score?', required: true, config: { min: 0, max: 10 } },
          ],
        },
      })
      const activateBtn = screen.getByRole('button', { name: /activate.*go to detail|^activate$/i })
      expect(activateBtn).toBeDisabled()
      expect(screen.getByText(/survey title.*required/i)).toBeInTheDocument()
    })

    it('blocks Activate when consent override is not yet attested', () => {
      setup({
        survey: {
          ...MOCK_DRAFT_SURVEY,
          title: 'Has title',
          // Brand is EXPLICIT; consentTextOverride present + no attestation row
          // means the operator hasn't attested → gate must fail.
          consentTextOverride: 'I agree (override)',
          consentSuppressedAttestedBy: null,
          questions: [
            { id: 'q1', type: 'rating', text: 'Score?', required: true, config: { min: 0, max: 10 } },
          ],
        },
      })
      expect(screen.getByText(/consent override.*not attested|attest.*before activating/i)).toBeInTheDocument()
    })
  })

  describe('success path', () => {
    it('clicking Activate calls activateSurvey then onActivated', async () => {
      const activateFn = vi.fn(async () => new Response(null, { status: 200 }))
      const onActivated = vi.fn()
      setup({
        survey: {
          ...MOCK_DRAFT_SURVEY,
          title: 'Quick check-in',
          questions: [
            { id: 'q1', type: 'rating', text: 'Score?', required: true, config: { min: 0, max: 10 } },
          ],
        },
        activateFn,
        onActivated,
      })
      fireEvent.click(screen.getByRole('button', { name: /activate.*go to detail|^activate$/i }))
      // Microtask settles.
      await screen.findByRole('dialog')
      expect(activateFn).toHaveBeenCalledWith(MOCK_DRAFT_SURVEY.id)
      expect(onActivated).toHaveBeenCalledOnce()
    })

    it('HTTP 422 from /status endpoint surfaces inline (modal stays open)', async () => {
      const activateFn = vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Survey is missing required fields' }), {
          status: 422,
        }),
      )
      setup({
        survey: {
          ...MOCK_DRAFT_SURVEY,
          title: 'Quick check-in',
          questions: [
            { id: 'q1', type: 'rating', text: 'Score?', required: true, config: { min: 0, max: 10 } },
          ],
        },
        activateFn,
      })
      fireEvent.click(screen.getByRole('button', { name: /activate.*go to detail|^activate$/i }))
      expect(await screen.findByTestId('activate-error')).toHaveTextContent(/missing required fields/i)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('cancel', () => {
    it('Cancel closes without calling activateSurvey', () => {
      const activateFn = vi.fn()
      const onClose = vi.fn()
      render(
        <ActivateModal
          open
          survey={{ ...MOCK_DRAFT_SURVEY, title: 'Quick check-in' }}
          brand={MOCK_BRAND_EXPLICIT}
          theme={MOCK_THEME_DEFAULT}
          activateSurvey={activateFn}
          onActivated={NOOP}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(activateFn).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
