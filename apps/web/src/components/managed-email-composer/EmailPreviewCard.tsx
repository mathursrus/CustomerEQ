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
    // survey_link: emit a clickable preview-only anchor with the sample URL.
    .replace(
      /\{\{\s*survey_link\s*\}\}/g,
      `<a href="${escapeHtml(ctx.surveyLink)}" style="color: #4f46e5; text-decoration: underline;">${escapeHtml(ctx.surveyLink)}</a>`,
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
}: EmailPreviewCardProps) {
  const recipientLabel = fullName(sampleRecipient)
  const recipientEmail = sampleRecipient?.identifier ?? 'sample@example.com'
  const fromAddress = `${senderAlias}@${senderDomain}`

  const origin =
    typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''
  const sampleSurveyLink = `${origin}/survey/${surveyId}/r/sample-token-xxxxxxxx`
  const sampleUnsubscribeLink = `${origin}/u/sample-token-xxxxxxxx`

  const brandLogoHtml = brandLogoUrl
    ? `<img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandName)} logo" style="height: 40px; vertical-align: middle;" />`
    : ''

  const renderedBody = useMemo(
    () =>
      substituteMustache(bodyHtml, {
        firstName: sampleRecipient?.firstName ?? 'Sample',
        lastName: sampleRecipient?.lastName ?? 'Recipient',
        surveyTitle: surveyTitle || '<survey title>',
        senderName: senderName || '<sender name>',
        brandName: brandName || '<brand name>',
        brandLogoHtml,
        surveyLink: sampleSurveyLink,
      }),
    [bodyHtml, sampleRecipient, surveyTitle, senderName, brandName, brandLogoHtml, sampleSurveyLink],
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

      {/* Email frame — mock lines 758-779 */}
      <div className="bg-white px-4 py-4 text-sm">
        <div className="mb-2 text-xs text-gray-600">
          <div>
            <strong className="text-gray-900">From:</strong> {senderName || '—'}{' '}
            <span className="font-mono text-gray-500">&lt;{fromAddress}&gt;</span>
          </div>
          <div>
            <strong className="text-gray-900">To:</strong> {recipientLabel}{' '}
            <span className="font-mono text-gray-500">&lt;{recipientEmail}&gt;</span>
          </div>
        </div>
        <div
          className="border-b border-gray-200 pb-2 text-base font-semibold text-gray-900"
          data-testid="email-preview-subject"
        >
          {subject || <span className="text-gray-400">&lt;subject&gt;</span>}
        </div>

        {/* Brand-header strip — appears only if the body's leading paragraphs
            contain {{brand_logo}} / {{brand_name}} (the R28 default), or the
            operator removed them. We always render the strip; if logoUrl is
            null the strip degrades to brand-name only (R28). */}
        <div className="my-3 flex items-center gap-3 border-b border-gray-200 pb-3">
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={`${brandName} logo`}
              className="h-10 w-auto"
              data-testid="email-preview-brand-logo"
            />
          ) : null}
          <div className="text-base font-semibold text-gray-900">{brandName || '—'}</div>
        </div>

        {/* Rendered body — mustache tokens substituted, HTML rendered. */}
        <div
          className="prose prose-sm max-w-none text-gray-800"
          data-testid="email-preview-body"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />

        {/* R30 auto-appended unsubscribe footer — non-editable in composer
            and previewed here so the operator sees the legally-required
            footer recipients will receive. */}
        <div
          className="mt-4 border-t border-gray-200 pt-2 text-xs text-gray-500"
          data-testid="email-preview-footer"
        >
          You received this survey because you&rsquo;re a customer or partner of{' '}
          {brandName || '—'}.<br />
          <a
            href={sampleUnsubscribeLink}
            className="text-indigo-600 underline"
            onClick={(e) => e.preventDefault()}
          >
            Unsubscribe
          </a>{' '}
          from future survey emails from {brandName || '—'}.
        </div>
      </div>
    </aside>
  )
}
