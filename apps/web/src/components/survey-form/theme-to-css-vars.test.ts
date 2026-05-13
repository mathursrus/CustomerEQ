import { describe, it, expect } from 'vitest'
import { themeToCssVars } from './theme-to-css-vars'
import { THEME_DISTINCT, THEME_NULL_BACKGROUND } from './__fixtures__/theme-default'

// Issue #241 Slice 4a — R31 token-to-element binding.
// Asserts every BrandTheme field maps to its expected `--ceq-*` CSS custom
// property. Defends against a binding silently going missing.

describe('themeToCssVars (R31 token contract)', () => {
  it('maps each color field to its --ceq-*-color property', () => {
    const vars = themeToCssVars(THEME_DISTINCT)
    expect(vars['--ceq-primary-color']).toBe('#0a84ff')
    expect(vars['--ceq-secondary-color']).toBe('#5ac8fa')
    expect(vars['--ceq-background-color']).toBe('#fdf6ec')
    expect(vars['--ceq-text-color']).toBe('#1d1d1f')
    expect(vars['--ceq-button-color']).toBe('#34c759')
    expect(vars['--ceq-button-text-color']).toBe('#ffffff')
    expect(vars['--ceq-accent-color']).toBe('#ff9500')
  })

  it('maps fontFamily verbatim', () => {
    const vars = themeToCssVars(THEME_DISTINCT)
    expect(vars['--ceq-font-family']).toBe('Inter, system-ui')
  })

  it('resolves headingSize / bodySize / borderRadius / maxWidth to pixel strings via the scale table', () => {
    const vars = themeToCssVars(THEME_DISTINCT)
    // RFC §"BrandTheme to Survey element token mapping" scale table:
    // headingSize lg → 32px, bodySize sm → 14px, borderRadius sm → 4px, maxWidth lg → 800px
    expect(vars['--ceq-heading-size']).toBe('32px')
    expect(vars['--ceq-body-size']).toBe('14px')
    expect(vars['--ceq-border-radius']).toBe('4px')
    expect(vars['--ceq-max-width']).toBe('800px')
  })

  it('renders backgroundImageUrl as a url() wrapper when set', () => {
    const vars = themeToCssVars(THEME_DISTINCT)
    expect(vars['--ceq-background-image']).toBe('url("https://example.com/bg.png")')
  })

  it('renders backgroundImageUrl as "none" when null', () => {
    const vars = themeToCssVars(THEME_NULL_BACKGROUND)
    expect(vars['--ceq-background-image']).toBe('none')
  })

  it('emits cardStyle as the enum string (renderer applies via class)', () => {
    expect(themeToCssVars(THEME_DISTINCT)['--ceq-card-style']).toBe('border')
  })

  it('produces a stable, complete set of 14 R31-tokenized CSS variables', () => {
    const vars = themeToCssVars(THEME_DISTINCT)
    const keys = Object.keys(vars).sort()
    // 7 colors + fontFamily + 4 sizes (heading/body/border/maxWidth) + backgroundImage + cardStyle = 14
    expect(keys).toEqual([
      '--ceq-accent-color',
      '--ceq-background-color',
      '--ceq-background-image',
      '--ceq-body-size',
      '--ceq-border-radius',
      '--ceq-button-color',
      '--ceq-button-text-color',
      '--ceq-card-style',
      '--ceq-font-family',
      '--ceq-heading-size',
      '--ceq-max-width',
      '--ceq-primary-color',
      '--ceq-secondary-color',
      '--ceq-text-color',
    ])
  })
})
