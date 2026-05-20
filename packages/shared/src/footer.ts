// Issue #413 — single source of truth for the "Powered by CustomerEQ"
// attribution footer that ships on every survey-bearing surface.
//
// Consumed by:
//   - apps/web/src/components/survey-form/PoweredByFooter.tsx (React)
//   - apps/api/src/routes/public.ts generateWidgetJs() (widget JS string)
//
// Keeping the constants here prevents drift between the React and widget
// surfaces within #413's own scope (two divergent hand-rolled copies of
// the same copy / aria-label / UTM URL would be a regression even before
// shipping). The cross-surface DOM consolidation (extract a shared HTML
// rendering helper used by both React and widget) is the subject of #476.
//
// This module is intentionally tiny + pure: literal strings + one URL
// builder. No React, no DOM, no runtime config. The URL is hardcoded per
// R4 (no environment-driven overrides — the attribution URL is part of
// the platform contract).
//
// Imported via the `@customerEQ/shared/footer` subpath export.

/**
 * Channels that distinguish the surface the footer appears in. Drives the
 * UTM `medium` parameter so customereq.com can attribute referral traffic
 * back to its source channel without per-respondent fingerprinting.
 *
 * - `link` — direct survey links (standalone + tokenized respondent pages).
 * - `embed` — embedded widget JS injected into host sites.
 * - `email` — survey-bearing email body (contract-only per #413 R5;
 *   the email-template renderer is a deferred follow-up).
 */
export type PoweredByChannel = 'link' | 'embed' | 'email'

/** Literal prefix text. Trailing space is intentional — the link follows. */
export const POWERED_BY_PREFIX = 'Powered by '

/** Link text. Always literally "CustomerEQ" (no translation per OD-5). */
export const POWERED_BY_LINK_TEXT = 'CustomerEQ'

/**
 * Accessible name for the anchor. Screen readers announce this in place
 * of the visible link text so the new-tab affordance is communicated.
 * Matches WCAG 2.4.7 + the existing mock CSS pattern in
 * docs/feature-specs/mocks/36-theme-editor.html L148-149.
 */
export const POWERED_BY_ARIA_LABEL =
  'Powered by CustomerEQ — opens customereq.com in a new tab'

/**
 * Builds the canonical "Powered by CustomerEQ" link URL with the three UTM
 * parameters required by R4. Per R4 + GDPR Art.5 §1(c) data minimisation:
 *
 *   - `utm_source` is always the literal `survey_footer` — never carries
 *     surveyId, brandId, or any other identifier.
 *   - `utm_medium` distinguishes the channel (`link` / `embed` / `email`).
 *   - `utm_campaign` is always the literal `powered_by`.
 *
 * No fourth parameter is added. The function is pure — callers can cache
 * the result per channel for the lifetime of the process if they want.
 */
export function buildFooterHref(channel: PoweredByChannel): string {
  const params = new URLSearchParams({
    utm_source: 'survey_footer',
    utm_medium: channel,
    utm_campaign: 'powered_by',
  })
  return `https://customereq.com/?${params.toString()}`
}
