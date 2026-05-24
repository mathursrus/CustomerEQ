// Spec R30a-d (issue #420) + mock #scene-3 lines 747-800 — live email
// preview pane on the right column of the MANAGED_EMAIL composer.
//
// The preview renders the email as a recipient would see it: meta block
// (From / To), Subject, brand-logo + brand-name header, body with mustache
// tokens substituted against the sample recipient (R30b — first selected
// member from the audience builder), and the auto-appended unsubscribe
// footer (R30). Preview live-updates as the operator edits any composer
// field — there is no "refresh preview" button (R30d).
//
// XSS posture: the body HTML is operator-authored and the preview is shown
// only to the same operator, so we can render it with dangerouslySetInnerHTML
// inside the email-frame. We still HTML-escape every substituted value
// (firstName / lastName / surveyTitle / etc.) because those come from
// database records that could in principle contain angle brackets.
//
// V0 scope: theme color-mapping legend (mock lines 781-798) is design-only
// per R30e — not rendered here. The email frame's static styling is fixed.

'use client'

import { useMemo } from 'react'

export interface SampleRecipient {
  firstName: string | null
  lastName: string | null
  identifier: string
}

export interface EmailPreviewTheme {
  primaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  buttonColor: string
  buttonTextColor: string
  fontFamily: string
}

export interface EmailPreviewCardProps {
  /** Composer state — preview reflects keystroke-by-keystroke (R30d). */
  senderName: string
  senderAlias: string
  senderDomain: string
  subject: string
  /** HTML emitted by the TipTap MustacheEditor; mustache tokens serialize
   *  back to literal `{{token}}` strings the substitution rules below match. */
  bodyHtml: string

  /** R30b — first selected member from the audience builder, or null when
   *  the operator hasn't selected anyone yet. */
  sampleRecipient: SampleRecipient | null

  /** R30c — brand context for {{brand_name}} + {{brand_logo}}. */
  brandName: string
  brandLogoUrl: string | null

  /** R30c — {{survey_title}} substitution + a realistic {{survey_link}}
   *  sample URL of shape `<origin>/survey/<surveyId>/r/<sample-token>`. */
  surveyTitle: string
  surveyId: string

  /** R30 unsubscribe footer renders unsubscribe link as `/u/<sample-token>`. */

  /** F14 — default brand theme so the preview matches what the worker renders
   *  in production via packages/shared/src/email/renderTemplate.ts. Falls
   *  back to neutral defaults when null. */
  theme?: EmailPreviewTheme | null
}

const DEFAULT_THEME: EmailPreviewTheme = {
  primaryColor: '#111827',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  accentColor: '#4f46e5',
  buttonColor: '#4f46e5',
  buttonTextColor: '#ffffff',
  fontFamily: 'system-ui',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return c
    }
  })
}

function fullName(sample: SampleRecipient | null): string {
  if (!sample) return 'Sample Recipient'
  const parts = [sample.firstName, sample.lastName].filter((s): s is string => Boolean(s))
  if (parts.length > 0) return parts.join(' ')
  return sample.identifier
}

interface SubstitutionContext {
  firstName: string
  lastName: string
  surveyTitle: string
  senderName: string
  brandName: string
  brandLogoHtml: string
  surveyLink: string
  accentColor: string
}

function substituteMustache(html: string, ctx: SubstitutionContext): string {
  return html
    .replace(/\{\{\s*first_name\s*\}\}/g, escapeHtml(ctx.firstName))
    .replace(/\{\{\s*last_name\s*\}\}/g, escapeHtml(ctx.lastName))
    .replace(/\{\{\s*survey_title\s*\}\}/g, escapeHtml(ctx.surveyTitle))
    .replace(/\{\{\s*sender_name\s*\}\}/g, escapeHtml(ctx.senderName))
    .replace(/\{\{\s*brand_name\s*\}\}/g, escapeHtml(ctx.brandName))
    // brand_logo: emit an <img> referencing Brand.logoUrl, or empty string
    // when logoUrl is null (R28 collapses the header to brand name only).
    .replace(/\{\{\s*brand_logo\s*\}\}/g, ctx.brandLogoHtml)
    // survey_link: emit a clickable preview-only anchor styled with the
    // theme accent color so the preview matches what the production renderer
    // applies via rewriteLinksWithAccent() in renderTemplate.ts.
    .replace(
      /\{\{\s*survey_link\s*\}\}/g,
      `<a href="${escapeHtml(ctx.surveyLink)}" style="color: ${escapeHtml(ctx.accentColor)}; text-decoration: underline;">${escapeHtml(ctx.surveyLink)}</a>`,
    )
}

export function EmailPreviewCard({
  senderName,
  senderAlias,
  senderDomain,
  subject,
  bodyHtml,
  sampleRecipient,
  brandName,
  brandLogoUrl,
  surveyTitle,
  surveyId,
  theme,
}: EmailPreviewCardProps) {
  const recipientLabel = fullName(sampleRecipient)
  const recipientEmail = sampleRecipient?.identifier ?? 'sample@example.com'
  const fromAddress = `${senderAlias}@${senderDomain}`
  const activeTheme = theme ?? DEFAULT_THEME
  const brandDisplayName = brandName || 'your brand'

  const origin =
    typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''
  const sampleSurveyLink = `${origin}/survey/${surveyId}/r/sample-token-xxxxxxxx`
  const sampleUnsubscribeLink = `${origin}/u/sample-token-xxxxxxxx`

  const brandLogoHtml = brandLogoUrl
    ? `<img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandDisplayName)} logo" style="height: 40px; vertical-align: middle;" />`
    : ''

  const renderedBody = useMemo(
    () =>
      substituteMustache(bodyHtml, {
        firstName: sampleRecipient?.firstName ?? 'Sample',
        lastName: sampleRecipient?.lastName ?? 'Recipient',
        surveyTitle: surveyTitle || '<survey title>',
        senderName: senderName || '<sender name>',
        // F5 — substitute even when brand name is empty; the preview's
        // brand-header strip + disclaimer already surface a visible "your
        // brand" fallback so a missing brand record is obvious.
        brandName: brandDisplayName,
        brandLogoHtml,
        surveyLink: sampleSurveyLink,
        accentColor: activeTheme.accentColor,
      }),
    [bodyHtml, sampleRecipient, surveyTitle, senderName, brandDisplayName, brandLogoHtml, sampleSurveyLink, activeTheme.accentColor],
  )

  return (
    <aside
      className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-4"
      data-testid="email-preview-card"
    >
      {/* Preview header chip — mock line 748: 📬 Live preview · "<recipient>" */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700">
        <span aria-hidden>📬</span>
        <span>
          Live preview ·{' '}
          <span className="font-semibold text-gray-900" data-testid="email-preview-recipient">
            &ldquo;{recipientLabel}&rdquo;
          </span>
        </span>
        {!sampleRecipient ? (
          <span
            className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
            data-testid="email-preview-no-audience"
          >
            No audience selected
          </span>
        ) : null}
      </div>

      {/* Email frame — mock lines 758-779. F14: backgroundColor + textColor +
          fontFamily from the brand's default theme, so the preview matches
          packages/shared/src/email/renderTemplate.ts rendering. */}
      <div
        className="px-4 py-4 text-sm"
        style={{
          backgroundColor: activeTheme.backgroundColor,
          color: activeTheme.textColor,
          fontFamily: `${activeTheme.fontFamily}, system-ui, -apple-system, sans-serif`,
        }}
      >
        <div className="mb-2 text-xs" style={{ color: activeTheme.textColor, opacity: 0.7 }}>
          <div>
            <strong style={{ color: activeTheme.textColor, opacity: 1 }}>From:</strong>{' '}
            {senderName || '—'}{' '}
            <span className="font-mono">&lt;{fromAddress}&gt;</span>
          </div>
          <div>
            <strong style={{ color: activeTheme.textColor, opacity: 1 }}>To:</strong>{' '}
            {recipientLabel}{' '}
            <span className="font-mono">&lt;{recipientEmail}&gt;</span>
          </div>
        </div>
        <div
          className="border-b pb-2 text-base font-semibold"
          style={{ borderColor: 'rgba(0,0,0,0.08)', color: activeTheme.textColor }}
          data-testid="email-preview-subject"
        >
          {subject || <span style={{ opacity: 0.4 }}>&lt;subject&gt;</span>}
        </div>

        {/* Brand-header strip — F14: brand name uses theme primaryColor so the
            recipient sees the brand identity at the same color the production
            renderer applies. F15: when brandName is empty we surface a visible
            "your brand" placeholder rather than the previous em-dash so it
            reads as something to fix instead of broken rendering. */}
        <div
          className="my-3 flex items-center gap-3 border-b pb-3"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={`${brandDisplayName} logo`}
              className="h-10 w-auto"
              data-testid="email-preview-brand-logo"
            />
          ) : null}
          <div
            className="text-base font-semibold"
            style={{ color: activeTheme.primaryColor }}
            data-testid="email-preview-brand-name"
          >
            {brandDisplayName}
          </div>
        </div>

        {/* Rendered body — mustache tokens substituted, HTML rendered. */}
        <div
          className="prose prose-sm max-w-none"
          style={{ color: activeTheme.textColor }}
          data-testid="email-preview-body"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />

        {/* R30 auto-appended unsubscribe footer — non-editable in composer
            and previewed here so the operator sees the legally-required
            footer recipients will receive. F15: brand display name (with
            fallback) substituted into the disclaimer. */}
        <div
          className="mt-4 border-t pt-2 text-xs"
          style={{ borderColor: 'rgba(0,0,0,0.08)', color: activeTheme.textColor, opacity: 0.7 }}
          data-testid="email-preview-footer"
        >
          You received this survey because you&rsquo;re a customer or partner of{' '}
          {brandDisplayName}.<br />
          <a
            href={sampleUnsubscribeLink}
            style={{ color: activeTheme.accentColor, textDecoration: 'underline' }}
            onClick={(e) => e.preventDefault()}
          >
            Unsubscribe
          </a>{' '}
          from future survey emails from {brandDisplayName}.
        </div>
      </div>
    </aside>
  )
}
