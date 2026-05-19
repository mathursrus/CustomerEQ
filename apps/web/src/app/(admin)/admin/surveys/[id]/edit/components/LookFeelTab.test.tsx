// Issue #241 Slice 4b (#336) — LookFeelTab RTL.
//
// Coverage per spec §2.3 / R17 / R18 / R19:
//   - Channel tabs (Standalone link / Embedded widget) — R17.
//   - Per channel: Desktop + Mobile previews rendered side-by-side — R17.
//   - Theme picker shows ALL brand themes (no count cap per R19); no
//     "Manage themes" link (RBAC: survey creator may not have theme-edit
//     access — R19 explicit + §E hide-vs-stub).
//   - Chrome matrix (3 rows × 2 cols per R18): logo / name / title toggles
//     for each channel propagate to <PreviewSurvey> via chromeMatrix prop.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { LookFeelTab } from './LookFeelTab'
import {
  MOCK_BRAND_EXPLICIT,
  MOCK_DRAFT_SURVEY,
  MOCK_THEME_ALT,
  MOCK_THEME_DEFAULT,
  MOCK_THEME_LIBRARY,
} from '../__fixtures__/editor-fixtures'

const NOOP = () => {}

function renderTab(opts: {
  themes?: typeof MOCK_THEME_LIBRARY
  survey?: typeof MOCK_DRAFT_SURVEY
  onChange?: (patch: { themeId?: string; settings?: Record<string, unknown> }) => void
} = {}) {
  return render(
    <LookFeelTab
      survey={opts.survey ?? MOCK_DRAFT_SURVEY}
      brand={MOCK_BRAND_EXPLICIT}
      themes={opts.themes ?? MOCK_THEME_LIBRARY}
      onChange={opts.onChange ?? NOOP}
      disabled={false}
    />,
  )
}

describe('<LookFeelTab>', () => {
  describe('channel tabs (R17)', () => {
    it('renders Standalone and Embedded channel tabs', () => {
      renderTab()
      expect(screen.getByRole('tab', { name: /standalone/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /embedded/i })).toBeInTheDocument()
    })

    it('clicking Embedded switches the previews to that channel', () => {
      renderTab()
      fireEvent.click(screen.getByRole('tab', { name: /embedded/i }))
      // Both viewport previews now data-channel="embedded".
      const previews = screen.getAllByTestId(/preview-(desktop|mobile)/)
      for (const p of previews) expect(p).toHaveAttribute('data-channel', 'embedded')
    })
  })

  describe('viewport split (R17)', () => {
    it('renders Desktop + Mobile previews side-by-side for the active channel', () => {
      renderTab()
      expect(screen.getByTestId('preview-desktop')).toBeInTheDocument()
      expect(screen.getByTestId('preview-mobile')).toBeInTheDocument()
    })

    it('mobile preview has data-viewport="mobile" (375px constraint from <PreviewSurvey>)', () => {
      renderTab()
      expect(screen.getByTestId('preview-mobile')).toHaveAttribute('data-viewport', 'mobile')
    })
  })

  describe('theme picker (R19)', () => {
    it('renders one option per brand theme (no count cap)', () => {
      renderTab({ themes: MOCK_THEME_LIBRARY })
      expect(screen.getByRole('radio', { name: MOCK_THEME_DEFAULT.name })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: MOCK_THEME_ALT.name })).toBeInTheDocument()
    })

    it('does NOT render a "Manage themes" link (RBAC: editor != themer)', () => {
      renderTab()
      expect(screen.queryByRole('link', { name: /manage themes/i })).not.toBeInTheDocument()
    })

    it('selecting a different theme calls onChange with the new themeId', () => {
      const onChange = vi.fn()
      renderTab({ onChange })
      fireEvent.click(screen.getByRole('radio', { name: MOCK_THEME_ALT.name }))
      const patch = onChange.mock.calls.at(-1)?.[0]
      expect(patch).toEqual(expect.objectContaining({ themeId: MOCK_THEME_ALT.id }))
    })
  })

  describe('chrome matrix (R18)', () => {
    it('renders three rows (logo / name / title) × two columns (Standalone / Embedded)', () => {
      renderTab()
      const matrix = screen.getByTestId('chrome-matrix')
      const rows = matrix.querySelectorAll('[data-row]')
      const rowKeys = Array.from(rows).map((r) => r.getAttribute('data-row'))
      expect(rowKeys).toEqual(['logo', 'name', 'title'])
    })

    it('toggling logo for standalone propagates to settings.chromeMatrix via onChange', () => {
      const onChange = vi.fn()
      renderTab({ onChange })
      const toggle = screen.getByTestId('chrome-toggle-standalone-logo')
      fireEvent.click(toggle)
      const patch = onChange.mock.calls.at(-1)?.[0]
      expect(patch.settings?.chromeMatrix?.standalone?.logo).toBe(false) // started at default TRUE → toggled to FALSE
    })

    it('handles settings=null defensively (Slice 4a Cluster B nullable-runtime-shape lesson)', () => {
      // survey.settings is null for fresh drafts. The component must read
      // settings?.chromeMatrix with optional chain and fall back to defaults.
      renderTab({ survey: { ...MOCK_DRAFT_SURVEY, settings: null } })
      const toggle = screen.getByTestId('chrome-toggle-standalone-logo')
      // Defaults: standalone.logo=true → checkbox is checked.
      expect(toggle).toBeChecked()
    })
  })

  describe('empty themes state — belts-and-suspenders fallback (Issue #405)', () => {
    // Updated behavior per Issue #405 user direction 2026-05-17:
    //   - Informational banner (not blocking) so the operator knows brand has
    //     no themes AND that the preview is rendering with the CustomerEQ
    //     default.
    //   - Preview STILL renders, using `FALLBACK_RESPONDENT_THEME` (same
    //     constant the public renderer uses as tier-3 fallback). Marketing-
    //     manager / survey-creator role isn't blocked waiting for an admin.
    //   - Theme picker fieldset is hidden — there's nothing to pick from
    //     until an admin seeds themes.
    //   - Chrome matrix below is theme-independent and continues to render.
    //   - Copy is RBAC-neutral: points at the admin role rather than
    //     deeplinking to org settings (survey creator may not have access).

    it('renders an informational empty-state banner when themes=[]', () => {
      renderTab({ themes: [] })
      expect(
        screen.getByText(/there are no themes defined for your brand/i),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/defaulting to the customerEQ default theme/i),
      ).toBeInTheDocument()
    })

    it('tells the operator administrators can set themes in Settings → Organization (no outbound link)', () => {
      renderTab({ themes: [] })
      expect(
        screen.getByText(/themes can be set by administrators/i),
      ).toBeInTheDocument()
      // No live link — survey-creator role may not have org-settings access.
      expect(
        screen.queryByRole('link', { name: /organization/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /open themes/i }),
      ).not.toBeInTheDocument()
    })

    it('still renders the desktop and mobile preview panes (using CustomerEQ default fallback) when themes=[]', () => {
      // The preview is not blocked — it falls back to FALLBACK_RESPONDENT_THEME
      // so the operator can preview their survey content even before themes
      // are seeded for the brand.
      renderTab({ themes: [] })
      expect(screen.getByTestId('preview-desktop')).toBeInTheDocument()
      expect(screen.getByTestId('preview-mobile')).toBeInTheDocument()
    })

    it('hides the theme picker fieldset when themes=[] (nothing to pick from)', () => {
      renderTab({ themes: [] })
      expect(
        screen.queryByRole('radiogroup', { name: /theme/i }),
      ).not.toBeInTheDocument()
    })

    it('still renders the chrome matrix when themes=[] (theme-independent)', () => {
      renderTab({ themes: [] })
      expect(screen.getByTestId('chrome-matrix')).toBeInTheDocument()
    })
  })

  describe('disabled mode (STOPPED)', () => {
    it('theme picker + chrome toggles disabled when disabled=true', () => {
      render(
        <LookFeelTab
          survey={MOCK_DRAFT_SURVEY}
          brand={MOCK_BRAND_EXPLICIT}
          themes={MOCK_THEME_LIBRARY}
          onChange={NOOP}
          disabled
        />,
      )
      expect(screen.getByRole('radio', { name: MOCK_THEME_DEFAULT.name })).toBeDisabled()
      expect(screen.getByTestId('chrome-toggle-standalone-logo')).toBeDisabled()
    })
  })
})
