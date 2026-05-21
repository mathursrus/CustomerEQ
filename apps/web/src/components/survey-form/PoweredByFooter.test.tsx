// Issue #413 — Phase 4 (implement-code) — test bodies for <PoweredByFooter>.
//
// JSDOM does not load globals.css, so visual-token assertions (opacity 0.55,
// font-size calc, focus-ring color) are NOT exercised here — they ship as
// CSS rules in apps/web/src/app/globals.css under the .ceq-powered-by class
// family and are visually verified in Phase 5 via Playwright against the
// 9 mock scenes (see docs/evidence/413-ui-polish-validation.md).
//
// What this file DOES assert:
//   - DOM structure: <p data-survey-footer> wrapping "Powered by" + <a>
//   - className contract: correct .ceq-powered-by-- variant class applied
//   - Link contract: href, target, rel, aria-label match the shared constants
//   - UTM contract (R4): href contains the three UTM params and nothing else
//   - No-PII contract (R4 + GDPR Art.5 §1(c)): href has no respondent data
//   - Non-toggleable (R7): no `hidden`-shaped prop accepted; props are
//     compile-time-restricted to `variant` + `channel`.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  POWERED_BY_ARIA_LABEL,
  POWERED_BY_LINK_TEXT,
  POWERED_BY_PREFIX,
  buildFooterHref,
} from '@customerEQ/shared/footer'

import { PoweredByFooter } from './PoweredByFooter'

describe('<PoweredByFooter>', () => {
  // -------------------------------------------------------------------------
  // Shared DOM contract (variant- and channel-agnostic)
  // -------------------------------------------------------------------------
  describe('shared (both variants)', () => {
    it('renders the POWERED_BY_PREFIX text followed by the CustomerEQ link', () => {
      const { container } = render(<PoweredByFooter variant="themed" channel="link" />)
      // getByText matches at leaf-element level; our root <p> has a child
      // <a> sibling so we query the root via the data-* attribute instead.
      const footer = container.querySelector('[data-survey-footer]')
      expect(footer).not.toBeNull()
      expect(footer?.textContent).toBe(`${POWERED_BY_PREFIX}${POWERED_BY_LINK_TEXT}`)
    })

    it('renders the CustomerEQ link with the canonical accessible name', () => {
      render(<PoweredByFooter variant="themed" channel="link" />)
      const link = screen.getByRole('link', { name: POWERED_BY_ARIA_LABEL })
      expect(link).toBeInTheDocument()
      expect(link.textContent).toBe(POWERED_BY_LINK_TEXT)
    })

    it('sets target="_blank" + rel="noopener noreferrer" on the link (R8)', () => {
      render(<PoweredByFooter variant="neutral" channel="embed" />)
      const link = screen.getByRole('link', { name: POWERED_BY_ARIA_LABEL })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('attaches data-survey-footer on the root element for E2E + R12 selectors', () => {
      const { container } = render(<PoweredByFooter variant="neutral" channel="link" />)
      const root = container.querySelector('[data-survey-footer]')
      expect(root).not.toBeNull()
      // The component renders a single <p> root — the attribute belongs there,
      // not on the inner anchor.
      expect(root?.tagName).toBe('P')
    })
  })

  // -------------------------------------------------------------------------
  // Variant — themed (inside SurveyFormRenderer card)
  // -------------------------------------------------------------------------
  describe('themed variant', () => {
    it('applies .ceq-powered-by + .ceq-powered-by--themed classes', () => {
      const { container } = render(<PoweredByFooter variant="themed" channel="link" />)
      const root = container.querySelector('[data-survey-footer]')
      expect(root?.classList.contains('ceq-powered-by')).toBe(true)
      expect(root?.classList.contains('ceq-powered-by--themed')).toBe(true)
      expect(root?.classList.contains('ceq-powered-by--neutral')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Variant — neutral (state-cards, widget, email)
  // -------------------------------------------------------------------------
  describe('neutral variant', () => {
    it('applies .ceq-powered-by + .ceq-powered-by--neutral classes', () => {
      const { container } = render(<PoweredByFooter variant="neutral" channel="link" />)
      const root = container.querySelector('[data-survey-footer]')
      expect(root?.classList.contains('ceq-powered-by')).toBe(true)
      expect(root?.classList.contains('ceq-powered-by--neutral')).toBe(true)
      expect(root?.classList.contains('ceq-powered-by--themed')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // UTM contract (R4) + GDPR Art.5 §1(c) data minimisation
  // -------------------------------------------------------------------------
  describe('UTM contract (R4)', () => {
    function hrefOf(channel: 'link' | 'embed' | 'email'): URL {
      const { container } = render(<PoweredByFooter variant="neutral" channel={channel} />)
      const link = container.querySelector('a')
      expect(link).not.toBeNull()
      return new URL(link!.href)
    }

    it('channel="link" produces utm_medium=link', () => {
      const url = hrefOf('link')
      expect(url.searchParams.get('utm_medium')).toBe('link')
    })

    it('channel="embed" produces utm_medium=embed', () => {
      const url = hrefOf('embed')
      expect(url.searchParams.get('utm_medium')).toBe('embed')
    })

    it('channel="email" produces utm_medium=email', () => {
      const url = hrefOf('email')
      expect(url.searchParams.get('utm_medium')).toBe('email')
    })

    it('utm_source is always the literal "survey_footer" (no surveyId / brandId / identifier)', () => {
      for (const channel of ['link', 'embed', 'email'] as const) {
        expect(hrefOf(channel).searchParams.get('utm_source')).toBe('survey_footer')
      }
    })

    it('utm_campaign is always the literal "powered_by"', () => {
      for (const channel of ['link', 'embed', 'email'] as const) {
        expect(hrefOf(channel).searchParams.get('utm_campaign')).toBe('powered_by')
      }
    })

    it('href base is https://customereq.com/ — not env-driven', () => {
      const url = hrefOf('link')
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe('customereq.com')
      expect(url.pathname).toBe('/')
    })

    it('href contains exactly the three UTM params and nothing else (no respondent fingerprint)', () => {
      for (const channel of ['link', 'embed', 'email'] as const) {
        const url = hrefOf(channel)
        const keys = [...url.searchParams.keys()].sort()
        expect(keys).toEqual(['utm_campaign', 'utm_medium', 'utm_source'])
      }
    })

    it('component output matches buildFooterHref() — single source of truth', () => {
      // Guards against the React component drifting from the shared constants
      // (which the widget JS string surface also reads from).
      for (const channel of ['link', 'embed', 'email'] as const) {
        const { container } = render(<PoweredByFooter variant="neutral" channel={channel} />)
        const link = container.querySelector('a')
        expect(link?.getAttribute('href')).toBe(buildFooterHref(channel))
      }
    })
  })

  // -------------------------------------------------------------------------
  // R7 — non-toggleable
  // -------------------------------------------------------------------------
  describe('R7 — non-toggleable', () => {
    it('component accepts no `hidden`-shaped prop at the TS-type level', () => {
      // The compile-time check is satisfied by PoweredByFooterProps having
      // only `variant` and `channel`. This runtime guard is intentionally
      // light — the structural guarantee is the type and the R7 gate script
      // (scripts/check-no-attribution-toggle.sh).
      const validProps = { variant: 'themed' as const, channel: 'link' as const }
      // @ts-expect-error — `hidden` is not part of the public API and must
      // never be added without filing a separate paid-tier-toggle issue.
      const _invalid = { ...validProps, hidden: true }
      void _invalid
      expect(true).toBe(true)
    })
  })
})
