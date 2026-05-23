import { describe, expect, it } from 'vitest'
import {
  renderEmailHtml,
  renderEmailPlainText,
  rewriteLinksWithAccent,
  type BrandThemeSnapshot,
  type ComposerSnapshot,
} from './renderTemplate.js'

const defaultTheme: BrandThemeSnapshot = {
  primaryColor: '#6366f1',
  secondaryColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  accentColor: '#6366f1',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  fontFamily: 'system-ui',
}

const baseComposer: ComposerSnapshot = {
  brandName: 'Acme',
  brandLogoUrl: 'https://logo.example/acme.png',
  subject: 'How was your delivery?',
  bodyHtml: '<p>Hi {{first_name}}, thanks for ordering from {{brand_name}}. <a href="{{survey_link}}">Take the survey</a>.</p>',
  senderName: 'Maya',
  senderEmail: 'maya@customereq.wellnessatwork.me',
  surveyTitle: 'Q2 NPS',
  unsubscribeUrl: 'https://app/u/abc123',
  surveyLink: 'https://app/s/r/xyz789',
  recipientFirstName: 'Priya',
  recipientLastName: 'Patel',
}

describe('renderEmailHtml — mustache substitution', () => {
  it('replaces {{first_name}} with the recipient first name', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toContain('Hi Priya')
  })

  it('replaces {{brand_name}} with the brand name in both body and footer', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    // Body
    expect(html).toContain('thanks for ordering from Acme')
    // Footer
    expect(html).toContain("you're a customer or partner of Acme")
  })

  it('replaces {{survey_link}} with the resolved per-recipient URL', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toContain('https://app/s/r/xyz789')
  })

  it('renders empty string for missing first_name (does not leak {{first_name}} literal)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, recipientFirstName: null })
    expect(html).not.toContain('{{first_name}}')
    expect(html).toContain('Hi ,')
  })
})

describe('renderEmailHtml — theme color threading', () => {
  it('applies primaryColor to the brand name h1', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toMatch(/color: #6366f1[^"]*">Acme<\/h1>/)
  })

  it('applies buttonColor + buttonTextColor to the CTA', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toMatch(/background-color: #6366f1; color: #ffffff/)
  })

  it('applies secondaryColor to the divider row', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toContain('border-top: 1px solid #818cf8')
  })

  it('applies accentColor to the unsubscribe link', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toMatch(/<a href="https:\/\/app\/u\/abc123" style="color: #6366f1/)
  })

  it('handles a non-default palette correctly', () => {
    const customTheme: BrandThemeSnapshot = {
      ...defaultTheme,
      primaryColor: '#ff0000',
      buttonColor: '#00ff00',
      accentColor: '#0000ff',
    }
    const html = renderEmailHtml(customTheme, baseComposer)
    expect(html).toContain('color: #ff0000')
    expect(html).toContain('background-color: #00ff00')
    expect(html).toContain('color: #0000ff')
  })
})

describe('renderEmailHtml — brand logo handling', () => {
  it('renders the <img> when brandLogoUrl is present', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toContain('<img src="https://logo.example/acme.png"')
  })

  it('renders no <img> when brandLogoUrl is null (no broken image, no leftover markup)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, brandLogoUrl: null })
    expect(html).not.toContain('<img')
  })

  it('escapes HTML in brandLogoUrl (defense against operator-controlled or scheme inputs)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, brandLogoUrl: 'https://x/"><script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('rewriteLinksWithAccent (idempotency rule)', () => {
  it('adds accent color to a link without style=', () => {
    const out = rewriteLinksWithAccent('<a href="x">y</a>', '#aabbcc')
    expect(out).toBe('<a href="x" style="color: #aabbcc; text-decoration: underline;">y</a>')
  })

  it('preserves operator-set style (operator wins)', () => {
    const out = rewriteLinksWithAccent('<a href="x" style="color: red">y</a>', '#aabbcc')
    expect(out).toBe('<a href="x" style="color: red">y</a>')
  })

  it('is idempotent — second pass is a no-op', () => {
    const once = rewriteLinksWithAccent('<a href="x">y</a>', '#aabbcc')
    const twice = rewriteLinksWithAccent(once, '#aabbcc')
    expect(twice).toBe(once)
  })

  it('rewrites multiple <a> tags', () => {
    const out = rewriteLinksWithAccent('<a href="x">y</a> and <a href="z">w</a>', '#aabbcc')
    const matches = out.match(/color: #aabbcc/g) ?? []
    expect(matches.length).toBe(2)
  })

  it('handles uppercase <A> tags', () => {
    const out = rewriteLinksWithAccent('<A href="x">y</A>', '#aabbcc')
    expect(out).toContain('style="color: #aabbcc')
  })
})

describe('renderEmailPlainText', () => {
  it('strips HTML and substitutes mustaches', () => {
    const txt = renderEmailPlainText(baseComposer)
    expect(txt).toContain('Hi Priya')
    expect(txt).toContain('thanks for ordering from Acme')
    expect(txt).not.toContain('<p>')
    expect(txt).not.toContain('<a')
  })

  it('includes the survey link as a raw URL', () => {
    const txt = renderEmailPlainText(baseComposer)
    expect(txt).toContain('Take the survey: https://app/s/r/xyz789')
  })

  it('includes the unsubscribe URL in the footer', () => {
    const txt = renderEmailPlainText(baseComposer)
    expect(txt).toContain('Unsubscribe: https://app/u/abc123')
  })
})
