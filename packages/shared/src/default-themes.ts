// Shared canonical "CustomerEQ default theme" set.
//
// Single source of truth used by:
//   • apps/api/src/routes/admin-brand-profile.ts — lazy-upsert nested
//     createMany seeds all four rows on first brand load.
//   • apps/api/src/routes/admin-brand-profile.ts — self-heal block re-seeds
//     when an existing brand has zero BrandTheme rows (Issue #405).
//   • apps/api/src/routes/public.ts — `GET /v1/public/surveys/:id` third-tier
//     theme-resolution fallback (Survey.themeId → Brand.defaultThemeId →
//     `FALLBACK_RESPONDENT_THEME`) so respondent renders never go un-themed.
//   • scripts/backfill-brand-default-themes.ts — one-off backfill that
//     identifies brands with zero themes and seeds the four defaults.
//   • apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/LookFeelTab.tsx
//     — when the brand has no themes yet, the editor preview renders using
//     `FALLBACK_RESPONDENT_THEME` so a marketing-manager-role operator can
//     iterate without waiting on an admin to seed brand themes.
//
// Color choices: primary + secondary follow the swatches shown in the spec
// mock (docs/feature-specs/mocks/277-organization-settings.html). Accent
// colors are intentionally NOT in the same hue family as primary/secondary
// — accent emphasizes *selection* (chosen radio/checkbox/MCQ option,
// selected Likert matrix cell, required-field asterisk) per the BrandTheme
// → Survey element token mapping in docs/rfcs/241-survey-admin-ux.md.
// Errors and warnings use a hardcoded semantic red (#dc2626), not a brand
// token, so accents are free to be calm/positive selection colors rather
// than red-adjacent.
//
// Typography and layout fields (fontFamily, headingSize, bodySize, cardStyle,
// borderRadius, maxWidth, backgroundImageUrl) are omitted on the seed type
// — BrandTheme schema defaults apply at insert time. They ARE present on
// FALLBACK_RESPONDENT_THEME below because that constant goes directly into
// renderer props (no DB round-trip to apply schema defaults).

export type DefaultThemeSeed = {
  name: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
}

export const DEFAULT_THEMES: readonly DefaultThemeSeed[] = [
  {
    name: 'Indigo',
    primaryColor: '#4f46e5',
    secondaryColor: '#7c3aed',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    buttonColor: '#4f46e5',
    buttonTextColor: '#ffffff',
    accentColor: '#047857',
  },
  {
    name: 'Forest',
    primaryColor: '#16a34a',
    secondaryColor: '#65a30d',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    buttonColor: '#16a34a',
    buttonTextColor: '#ffffff',
    accentColor: '#0369a1',
  },
  {
    name: 'Sunset',
    primaryColor: '#ea580c',
    secondaryColor: '#d97706',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    buttonColor: '#ea580c',
    buttonTextColor: '#ffffff',
    accentColor: '#0f766e',
  },
  {
    name: 'Slate',
    primaryColor: '#475569',
    secondaryColor: '#334155',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    buttonColor: '#475569',
    buttonTextColor: '#ffffff',
    accentColor: '#4338ca',
  },
] as const

export const DEFAULT_THEME_NAMES = DEFAULT_THEMES.map((t) => t.name)

// Issue #405 — sentinel id for FALLBACK_RESPONDENT_THEME. Used by the public
// renderer (third-tier fallback) and the editor preview (preview-when-no-
// themes). Consumers can detect "is this the CustomerEQ fallback?" by id.
export const FALLBACK_RESPONDENT_THEME_ID = '__customereq_default_indigo__'

// Issue #405 — the BrandThemeLite-shaped fallback. Built from
// DEFAULT_THEMES[0] (Indigo) + typography defaults that match the Prisma
// BrandTheme schema's `@default(...)`
// (packages/database/prisma/schema.prisma:719-726). A fallback render
// rendered through this object is visually indistinguishable from a real
// seeded Indigo BrandTheme row — same hex values, same typography. The
// sentinel id makes the fallback origin obvious in logs / analytics.
export const FALLBACK_RESPONDENT_THEME = {
  id: FALLBACK_RESPONDENT_THEME_ID,
  ...DEFAULT_THEMES[0],
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  cardStyle: 'shadow',
  borderRadius: 'md',
  maxWidth: 'md',
  backgroundImageUrl: null,
} as const
