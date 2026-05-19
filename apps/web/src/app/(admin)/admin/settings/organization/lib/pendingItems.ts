import { hasPrivacyToken } from '@customerEQ/consent-text'
import type { OrgFormValues, PendingItem, PendingItemContext } from './types'

// Issue #292 Slice 4 — pending-fields computation.
//
// Computed client-side from the live form values per spec §UI mocks /
// "Required-field discovery" section. Banner re-renders on every change;
// rows clear automatically when the field resolves. No state machine.
//
// Required-field set in v0 (spec §F1b / §F8 / §F9):
//  • name (Brand name) — always required, non-empty trimmed
//  • consentTextDefault — required AND must contain {{privacy}} when EXPLICIT
//  • privacyPolicyUrl — required when EXPLICIT, OR whenever consent text
//    contains a {{privacy}} token (otherwise the rendered link is broken)
//
// Issue #405 — additional rows derived from server-loaded brand state
// (NOT live form values, to avoid in-flight form edits flickering the
// banner before they're saved):
//  • themes — emitted when the brand has zero BrandTheme rows. Subsumes
//    the defaultTheme row (no themes ⇒ no default possible).
//  • defaultTheme — emitted when themes exist but defaultThemeId is null.

export function computePendingItems(
  values: OrgFormValues,
  context: PendingItemContext,
): PendingItem[] {
  const items: PendingItem[] = []

  if (!values.name.trim()) {
    items.push({
      field: 'name',
      label: 'Brand name',
      consequence:
        'is empty — required as the customer-facing display name on member portals, surveys, and emails.',
      jumpToSectionId: 's-identity',
    })
  }

  const consentText = values.consentTextDefault.trim()
  const consentTextReferencesPrivacy = consentText !== '' && hasPrivacyToken(consentText)

  if (values.consentMode === 'EXPLICIT') {
    if (consentText === '') {
      items.push({
        field: 'consentTextDefault',
        label: 'Consent text',
        consequence:
          'is empty — Explicit consent mode requires consent text with a privacy link.',
        jumpToSectionId: 's-consent',
      })
    } else if (!hasPrivacyToken(consentText)) {
      items.push({
        field: 'consentTextDefault',
        label: 'Consent text',
        consequence:
          'is missing a privacy link — Explicit consent mode requires a {{privacy}} token in your consent text.',
        jumpToSectionId: 's-consent',
      })
    }
  }

  const privacyUrlMissing = !values.privacyPolicyUrl.trim()
  if (privacyUrlMissing && (values.consentMode === 'EXPLICIT' || consentTextReferencesPrivacy)) {
    items.push({
      field: 'privacyPolicyUrl',
      label: 'Privacy policy URL',
      consequence:
        values.consentMode === 'EXPLICIT'
          ? 'is empty — required by Explicit consent mode and referenced by the {{privacy}} link in your consent text.'
          : 'is empty — your consent text references a {{privacy}} link that has nowhere to point.',
      jumpToSectionId: 's-consent',
    })
  }

  // Issue #405 — themes-related rows. Emit only when reflected in server
  // state (PendingItemContext), not OrgFormValues.defaultThemeId, so that
  // an admin editing the form locally doesn't see the banner clear before
  // they actually save.
  if (context.themesCount === 0) {
    items.push({
      field: 'themes',
      label: 'Themes',
      consequence:
        'no themes are configured for your brand yet — customer-facing surveys can’t render until at least one theme exists.',
      jumpToSectionId: 's-lookfeel',
    })
    // Subsumed: no themes means no default to point at; one row, not two.
  } else if (!context.hasDefaultTheme) {
    items.push({
      field: 'defaultTheme',
      label: 'Default theme',
      consequence:
        'no default theme is set — new surveys will need a theme picked manually.',
      jumpToSectionId: 's-lookfeel',
    })
  }

  return items
}
