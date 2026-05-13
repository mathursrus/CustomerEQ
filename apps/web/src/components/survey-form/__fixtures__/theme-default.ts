// Issue #241 Slice 4a — BrandTheme fixture covering every R31-tokenized field
// with a deliberately non-default value so theme-to-css-vars.test.ts catches
// any missing binding.

export interface BrandThemeFixture {
  id: string
  name: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
  fontFamily: string
  headingSize: 'sm' | 'md' | 'lg'
  bodySize: 'sm' | 'md' | 'lg'
  maxWidth: 'sm' | 'md' | 'lg'
  borderRadius: 'sm' | 'md' | 'lg'
  cardStyle: 'shadow' | 'border' | 'flat'
  backgroundImageUrl: string | null
}

export const THEME_DISTINCT: BrandThemeFixture = {
  id: 'thm_fixture_distinct',
  name: 'Fixture · all-distinct',
  primaryColor: '#0a84ff',
  secondaryColor: '#5ac8fa',
  backgroundColor: '#fdf6ec',
  textColor: '#1d1d1f',
  buttonColor: '#34c759',
  buttonTextColor: '#ffffff',
  accentColor: '#ff9500',
  fontFamily: 'Inter, system-ui',
  headingSize: 'lg',
  bodySize: 'sm',
  maxWidth: 'lg',
  borderRadius: 'sm',
  cardStyle: 'border',
  backgroundImageUrl: 'https://example.com/bg.png',
}

export const THEME_NULL_BACKGROUND: BrandThemeFixture = {
  ...THEME_DISTINCT,
  id: 'thm_fixture_no_bg',
  backgroundImageUrl: null,
}
