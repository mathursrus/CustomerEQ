// Spike: cross-client theme rendering for #420 MANAGED_EMAIL.
// Mirrors RFC §6. Pure function; no side effects. Will become the basis
// of the worker's email-rendering helper in apps/worker/src/processors/managedEmailSend.ts.
//
// Properties chosen against caniemail.com (industry-standard email-client-support tracker)
// — only widely-supported properties are used:
//   - inline `style="…"` only (no <style> blocks; <style> is stripped by Gmail web on some templates)
//   - no Flexbox, no Grid, no CSS variables, no @media queries
//   - <table>-based outer layout for Outlook desktop (Outlook uses Word's rendering engine for tables)
//   - <hr> styled via border-top (Outlook desktop ignores `border` shorthand on <hr>)
//   - <a> color set inline (Gmail iOS auto-recolors links unless inline style is set)

export type BrandThemeSnapshot = {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  buttonColor: string
  buttonTextColor: string
  fontFamily: string
}

export type ComposerSnapshot = {
  brandName: string
  brandLogoUrl: string | null // null if Brand.logoUrl unset
  subject: string
  bodyHtml: string // operator-authored TipTap-rendered HTML; contains literal {{survey_link}}
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

export function renderEmailHtml(theme: BrandThemeSnapshot, composer: ComposerSnapshot): string {
  const vars: Record<string, string> = {
    survey_link: composer.surveyLink,
    survey_title: composer.surveyTitle,
    sender_name: composer.senderName,
    brand_name: composer.brandName,
    brand_logo: composer.brandLogoUrl ?? '',
    first_name: composer.recipientFirstName ?? '',
    last_name: composer.recipientLastName ?? '',
  }

  const renderedBody = renderMustaches(composer.bodyHtml, vars)

  // Note: outer <table> for Outlook desktop. Inner styles all inline.
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
            <td align="center" style="padding: 24px 24px 16px 24px;">
              ${composer.brandLogoUrl
                ? `<img src="${escapeHtml(composer.brandLogoUrl)}" alt="${escapeHtml(composer.brandName)}" width="200" style="display: block; max-height: 60px; max-width: 200px; border: 0;" />`
                : ''}
              <h1 style="margin: 12px 0 0 0; color: ${theme.primaryColor}; font-size: 20px; font-weight: 600; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">${escapeHtml(composer.brandName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; color: ${theme.textColor}; font-size: 15px; line-height: 1.6; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">
              ${rewriteLinksWithAccent(renderedBody, theme.accentColor)}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 24px 16px 24px;">
              <a href="${escapeHtml(composer.surveyLink)}" style="display: inline-block; background-color: ${theme.buttonColor}; color: ${theme.buttonTextColor}; padding: 12px 24px; text-decoration: none; font-weight: 600; font-family: ${theme.fontFamily}, system-ui, -apple-system, sans-serif;">Take the survey</a>
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
  return `${composer.brandName}

${renderedBody}

Take the survey: ${composer.surveyLink}

---
You received this survey because you're a customer or partner of ${composer.brandName}.
Unsubscribe: ${composer.unsubscribeUrl}
`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Inline-style links inside the operator body so they pick up the theme accent color.
// Idempotent: <a> tags already styled inline keep their existing color attribute.
function rewriteLinksWithAccent(html: string, accentColor: string): string {
  return html.replace(/<a(\s+[^>]*)?>/gi, (match, attrs: string | undefined) => {
    const a = attrs ?? ''
    if (/style\s*=/i.test(a)) {
      return match // operator-styled link wins
    }
    return `<a${a} style="color: ${accentColor}; text-decoration: underline;">`
  })
}
