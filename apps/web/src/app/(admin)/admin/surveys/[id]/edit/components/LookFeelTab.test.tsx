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

  describe('empty themes state (Issue #405)', () => {
    // Today the component renders an empty <div role="radiogroup"> and a
    // silent `{theme && <PreviewSurvey>}` skip when themes=[] — the operator
    // sees nothing and can't tell whether data is loading, the page is
    // broken, or themes were never configured. RBAC-neutral copy because a
    // future survey-creator role may not have access to Organization Settings.

    it('renders an explicit empty-state message when themes=[]', () => {
      renderTab({ themes: [] })
      // Anchor on a phrase from the new copy. Keep loose enough that minor
      // wording changes don't flake the assertion.
      expect(
        screen.getByText(/no themes are configured for this brand/i),
      ).toBeInTheDocument()
    })

    it('tells the operator to contact an administrator (RBAC-neutral — no outbound link)', () => {
      renderTab({ themes: [] })
      expect(
        screen.getByText(/contact a brand administrator/i),
      ).toBeInTheDocument()
      // No link to Organization Settings — survey-creator RBAC may not allow it.
      expect(
        screen.queryByRole('link', { name: /organization settings/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /open themes/i }),
      ).not.toBeInTheDocument()
    })

    it('does NOT render the desktop or mobile preview panes when themes=[]', () => {
      // Previously the preview containers still rendered with just their
      // labels but no <PreviewSurvey> child — two side-by-side blank boxes
      // with no explanation. The empty state replaces them entirely with
      // the single message.
      renderTab({ themes: [] })
      expect(screen.queryByTestId('preview-desktop')).not.toBeInTheDocument()
      expect(screen.queryByTestId('preview-mobile')).not.toBeInTheDocument()
    })

    it('still renders the chrome matrix when themes=[] (it does not depend on themes)', () => {
      // The Chrome matrix below the preview is theme-independent — toggling
      // logo/name/title for each channel doesn't require any theme to exist.
      // Don't accidentally hide it as part of the empty-state branch.
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
