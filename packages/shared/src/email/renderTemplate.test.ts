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

  it('replaces {{brand_name}} with a themed brand-name span in the body and inserts the brand name verbatim in the footer', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    // Body: brand_name is now wrapped in a themed <span> (G4/G8), so the
    // assertion matches "thanks for ordering from <span ...>Acme</span>."
    expect(html).toMatch(/thanks for ordering from <span[^>]*>Acme<\/span>\./)
    // Footer: the auto-appended disclaimer still embeds brandName as escaped
    // text (footer is template-controlled, not operator-controlled).
    expect(html).toContain("you're a customer or partner of Acme")
  })

  it('replaces {{survey_link}} with a clickable themed <a> wrapping the resolved URL (G19)', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    // The body's <a href="{{survey_link}}"> form keeps the operator-wrapped
    // anchor; the standalone {{survey_link}} token substitutes to its own
    // anchor. Both contain the resolved URL.
    expect(html).toContain('https://app/s/r/xyz789')
    expect(html).toMatch(/<a href="https:\/\/app\/s\/r\/xyz789" style="color: #6366f1/)
  })

  it('always-on themed "Take the survey" CTA below the body (G19)', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toMatch(/<a href="https:\/\/app\/s\/r\/xyz789"[^>]*background-color: #6366f1[^>]*>Take the survey<\/a>/)
  })

  it('renders empty string for missing first_name (does not leak {{first_name}} literal)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, recipientFirstName: null })
    expect(html).not.toContain('{{first_name}}')
    expect(html).toContain('Hi ,')
  })
})

describe('renderEmailHtml — theme color threading', () => {
  it('applies primaryColor to the brand_name mustache substitution (G4/G8)', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    // brand_name in the body substitutes to a themed <span>.
    expect(html).toMatch(/<span style="color: #6366f1; font-weight: 600;[^"]*">Acme<\/span>/)
  })

  it('applies secondaryColor to the divider row', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toContain('border-top: 1px solid #818cf8')
  })

  it('applies accentColor to the unsubscribe link', () => {
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).toMatch(/<a href="https:\/\/app\/u\/abc123" style="color: #6366f1/)
  })

  it('applies a non-default primaryColor to the brand_name span', () => {
    const customTheme: BrandThemeSnapshot = {
      ...defaultTheme,
      primaryColor: '#ff0000',
      accentColor: '#0000ff',
    }
    const html = renderEmailHtml(customTheme, baseComposer)
    expect(html).toContain('color: #ff0000')
    expect(html).toContain('color: #0000ff')
  })
})

describe('renderEmailHtml — brand logo handling (G4/G7 — only via mustache)', () => {
  const bodyWithLogo = `<p>{{brand_logo}}</p>${baseComposer.bodyHtml}`

  it('renders an <img> for {{brand_logo}} when the body contains the mustache token and brandLogoUrl is set', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo })
    expect(html).toContain('<img src="https://logo.example/acme.png"')
    expect(html).toContain('max-height: 60px')
  })

  it('renders no <img> when the body has {{brand_logo}} but brandLogoUrl is null (graceful degradation)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo, brandLogoUrl: null })
    expect(html).not.toContain('<img')
  })

  it('renders no <img> when the body does NOT contain {{brand_logo}} (no always-on brand header)', () => {
    // baseComposer.bodyHtml has no {{brand_logo}} → img must not appear.
    const html = renderEmailHtml(defaultTheme, baseComposer)
    expect(html).not.toContain('<img')
  })

  it('escapes HTML in brandLogoUrl (defense against operator-controlled or scheme inputs)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo, brandLogoUrl: 'https://x/"><script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })

  // Issue #540 F2 — Outlook desktop's Word renderer ignores inline CSS
  // max-width / max-height. The fix adds an explicit `width="..."` HTML
  // attribute (Outlook's only honored sizer for <img>) plus `height:auto`
  // inline so aspect ratio is preserved (resize, not crop) in all clients.
  it('emits a width HTML attribute (Outlook respects this; ignores inline max-width)', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo })
    expect(html).toMatch(/<img[^>]*\swidth="\d+"/)
  })

  it('preserves aspect ratio via inline height:auto so large logos resize, not crop', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo })
    expect(html).toMatch(/<img[^>]*height\s*:\s*auto/)
  })

  it('keeps max-height as the CSS-respecting upper bound for very wide-short logos', () => {
    const html = renderEmailHtml(defaultTheme, { ...baseComposer, bodyHtml: bodyWithLogo })
    expect(html).toContain('max-height: 60px')
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
