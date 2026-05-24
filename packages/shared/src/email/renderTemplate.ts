// Issue #420 — email-template renderer for MANAGED_EMAIL send.
// Lifted from spike/420-cross-client-rendering/render-template.ts after
// the §9.3 spike validated the structure in Chromium (Webkit-derived) at
// desktop + mobile widths. See spike/420-cross-client-rendering/FINDINGS.md
// for cross-client compatibility notes.
//
// Email-client constraints honored (per caniemail.com / EmailOnAcid):
//   - inline `style="…"` only (no <style> blocks; Gmail web strips these)
//   - no Flexbox, no Grid, no CSS variables, no @media queries
//   - <table>-based outer layout (Outlook desktop uses Word's rendering engine)
//   - <hr>-substitute via single-cell <table> row with border-top
//     (Outlook desktop strips border styling from raw <hr>)
//   - <a> color set inline (Gmail iOS auto-recolors links unless overridden)
//   - link auto-styling: operator-authored <a> tags inside the body that don't
//     carry an explicit style= get the accent color applied; operator-set
//     style= wins (idempotent)

export interface BrandThemeSnapshot {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  buttonColor: string
  buttonTextColor: string
  fontFamily: string
}

export interface ComposerSnapshot {
  brandName: string
  brandLogoUrl: string | null
  subject: string
  bodyHtml: string // operator-authored TipTap-rendered HTML; contains literal {{mustache}} tokens
  senderName: string
  senderEmail: string // resolved senderAlias@senderDomain
  surveyTitle: string
  unsubscribeUrl: string // resolved /u/:token URL
  surveyLink: string // resolved per-recipient survey URL
  recipientFirstName: string | null
  recipientLastName: string | null
}

const MUSTACHE_RE = /\{\{(\w+)\}\}/g

function renderMustaches(template: string, vars: Record<string, string>): string {
  return template.replace(MUSTACHE_RE, (_match, key: string) => vars[key] ?? '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Inline-style links inside the operator body so they pick up the theme accent color.
 * Idempotent: `<a>` tags already styled inline keep their existing color attribute.
 */
export function rewriteLinksWithAccent(html: string, accentColor: string): string {
  return html.replace(/<a(\s+[^>]*)?>/gi, (match, attrs: string | undefined) => {
    const a = attrs ?? ''
    if (/style\s*=/i.test(a)) {
      return match
    }
    return `<a${a} style="color: ${accentColor}; text-decoration: underline;">`
  })
}

export function renderEmailHtml(theme: BrandThemeSnapshot, composer: ComposerSnapshot): string {
  // G4/G7/G8 — mustache substitutions for {{brand_logo}} and {{brand_name}}
  // emit theme-styled HTML fragments (not bare strings) so the rendered email
  // matches the preview and so the operator's body controls WHERE brand identity
  // appears. The always-on brand header + always-on "Take the survey" button
  // are removed: the operator can compose the email with whatever mustache
  // tokens they need, and only those positions render brand-identity content.
  const brandLogoFragment = composer.brandLogoUrl
    ? `<img src="${escapeHtml(composer.brandLogoUrl)}" alt="${escapeHtml(composer.brandName)}" style="max-height: 60px; max-width: 200px; border: 0; vertical-align: middle;" />`
    : ''
  const brandNameFragment = `<span style="color: ${theme.primaryColor}; font-weight: 600; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">${escapeHtml(composer.brandName)}</span>`

  const vars: Record<string, string> = {
    survey_link: composer.surveyLink,
    survey_title: escapeHtml(composer.surveyTitle),
    sender_name: escapeHtml(composer.senderName),
    brand_name: brandNameFragment,
    brand_logo: brandLogoFragment,
    first_name: escapeHtml(composer.recipientFirstName ?? ''),
    last_name: escapeHtml(composer.recipientLastName ?? ''),
  }
  const renderedBody = renderMustaches(composer.bodyHtml, vars)

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${escapeHtml(composer.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.backgroundColor}; color: ${theme.textColor}; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${theme.backgroundColor};">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="padding: 16px 24px; color: ${theme.textColor}; font-size: 15px; line-height: 1.6; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">
              ${rewriteLinksWithAccent(renderedBody, theme.accentColor)}
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid ${theme.secondaryColor}; height: 1px; line-height: 1px; font-size: 1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 24px 24px 24px; color: ${theme.textColor}; opacity: 0.7; font-size: 11px; line-height: 1.5; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">
              You received this survey because you're a customer or partner of ${escapeHtml(composer.brandName)}.
              <a href="${escapeHtml(composer.unsubscribeUrl)}" style="color: ${theme.accentColor}; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderEmailPlainText(composer: ComposerSnapshot): string {
  const vars: Record<string, string> = {
    survey_link: composer.surveyLink,
    survey_title: composer.surveyTitle,
    sender_name: composer.senderName,
    brand_name: composer.brandName,
    brand_logo: '',
    first_name: composer.recipientFirstName ?? '',
    last_name: composer.recipientLastName ?? '',
  }
  const renderedBody = stripHtml(renderMustaches(composer.bodyHtml, vars))
  return `${composer.brandName}\n\n${renderedBody}\n\nTake the survey: ${composer.surveyLink}\n\n---\nYou received this survey because you're a customer or partner of ${composer.brandName}.\nUnsubscribe: ${composer.unsubscribeUrl}\n`
}
