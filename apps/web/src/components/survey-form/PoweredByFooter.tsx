// Issue #413 — "Powered by CustomerEQ" attribution footer.
//
// Renders the platform-attribution footer that ships on every survey-bearing
// surface. Two visual variants:
//
//   - "themed": rendered inside the SurveyFormRenderer card; inherits the
//     brand theme via --ceq-* CSS variables on the parent. Used for the
//     active questions surface (Scene 1 in the mock).
//
//   - "neutral": rendered below page state-cards (loading, error, duplicate,
//     thank-you), inside the embedded widget container, and in email bodies.
//     Uses hardcoded gray hex values per the canonical .powered-by pattern
//     in docs/feature-specs/mocks/36-theme-editor.html L148-149. Theming
//     the state-cards / widget / email is a separate deferred follow-up.
//
// The footer is non-toggleable per R7: there is no `hidden` prop, no env
// var, no settings field that suppresses it. Brand-level attribution
// toggle (paid-tier capability) is captured in the spec's Deferred
// follow-ups.
//
// Constants + URL builder come from `@customerEQ/shared/footer` so the
// React surface and the widget JS string surface share the exact copy,
// aria-label, and UTM contract. Cross-surface DOM consolidation (a shared
// HTML renderer) is the subject of #476 and is intentionally out of scope
// here.
//
// CSS rules live in apps/web/src/app/globals.css under the .ceq-powered-by
// class family. The same rules are duplicated in the widget JS's <style>
// injection (apps/api/src/routes/public.ts generateWidgetJs()) because
// the widget runs on host pages that don't load globals.css.
//
// Spec: docs/feature-specs/413-survey-footer.md
// Mock: docs/feature-specs/mocks/413-survey-footer.html

import {
  buildFooterHref,
  POWERED_BY_ARIA_LABEL,
  POWERED_BY_LINK_TEXT,
  POWERED_BY_PREFIX,
  type PoweredByChannel,
} from '@customerEQ/shared/footer'

export interface PoweredByFooterProps {
  /**
   * Visual variant — drives only color/font/opacity. The DOM structure,
   * link target, UTM contract, and accessibility attributes are identical
   * across variants.
   */
  variant: 'themed' | 'neutral'
  /**
   * UTM medium channel for the link href.
   * 'link' — standalone + tokenized respondent pages.
   * 'embed' — embedded widget JS (the React component isn't used here,
   *   but the channel is exposed for completeness so the constant set
   *   stays useful if a future React-rendered embed lands).
   * 'email' — survey-bearing email body (contract only per R5).
   */
  channel: PoweredByChannel
}

export function PoweredByFooter({ variant, channel }: PoweredByFooterProps) {
  const variantClass =
    variant === 'themed' ? 'ceq-powered-by--themed' : 'ceq-powered-by--neutral'

  return (
    <p className={`ceq-powered-by ${variantClass}`} data-survey-footer>
      {POWERED_BY_PREFIX}
      <a
        href={buildFooterHref(channel)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={POWERED_BY_ARIA_LABEL}
      >
        {POWERED_BY_LINK_TEXT}
      </a>
    </p>
  )
}
