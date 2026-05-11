// Four default BrandTheme rows seeded for every new Brand on first lazy-upsert
// (RFC §4.1, R25). Spec contract is "all four pickable from first paint" on
// the Look & Feel section of /admin/settings/organization.
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
// borderRadius, maxWidth, backgroundImageUrl) are omitted intentionally —
// BrandTheme schema defaults apply, and v0 does not vary these per stock
// theme.

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
