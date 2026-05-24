// Spec §3.2 — read-only composer snapshot rendered on the Wave Detail page for
// MANAGED_EMAIL batches so operators can audit exactly what was sent for a
// given wave.
//
// G12 — this block reuses EmailPreviewCard rather than duplicating
// markup, so the post-send WYSIWYG view matches the compose-time preview
// (mustache substitutions, theme colors, brand-identity placement). The
// snapshot persists `themeSnapshot` (per the worker's renderEmailHtml
// pipeline); we pass those colors through directly. Sample recipient is null
// here — the snapshot is per-batch, not per-recipient — so EmailPreviewCard
// falls back to "Sample Recipient" placeholders for first_name etc.

'use client'

import { EmailPreviewCard, type EmailPreviewTheme } from '@/components/managed-email-composer/EmailPreviewCard'

export interface ComposerSnapshot {
  senderName: string
  senderAlias: string
  senderDomain: string
  subject: string
  /** G20 — operator-edited "Survey name in mail" field. Drives {{survey_title}}
   *  substitution in the preview. Optional for batches persisted before G20. */
  surveyNameInMail?: string
  body: string
  brandLogoUrl: string | null
  brandName: string
  // themeSnapshot is persisted by the worker pipeline and passes through the
  // BatchDetailResponseSchema's `.passthrough()` clause. Optional here to keep
  // pre-#420 batches (no theme captured) renderable with neutral defaults.
  themeSnapshot?: {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    textColor: string
    accentColor: string
    buttonColor: string
    buttonTextColor: string
    fontFamily: string
  } | null
}

export function ComposerSnapshotBlock({
  snapshot,
  surveyId,
}: {
  snapshot: ComposerSnapshot
  surveyId: string
}) {
  const previewTheme: EmailPreviewTheme | null = snapshot.themeSnapshot
    ? {
        primaryColor: snapshot.themeSnapshot.primaryColor,
        backgroundColor: snapshot.themeSnapshot.backgroundColor,
        textColor: snapshot.themeSnapshot.textColor,
        accentColor: snapshot.themeSnapshot.accentColor,
        buttonColor: snapshot.themeSnapshot.buttonColor,
        buttonTextColor: snapshot.themeSnapshot.buttonTextColor,
        fontFamily: snapshot.themeSnapshot.fontFamily,
      }
    : null

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
      data-testid="composer-snapshot-block"
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Composer snapshot</h2>
        <p className="mt-1 text-[11px] text-gray-500">
          Read-only WYSIWYG of what the operator sent. Mustache tokens substitute
          against a sample recipient (no real member data); theme colors are the
          snapshot taken at send time.
        </p>
      </div>
      <EmailPreviewCard
        senderName={snapshot.senderName}
        senderAlias={snapshot.senderAlias}
        senderDomain={snapshot.senderDomain}
        subject={snapshot.subject}
        bodyHtml={snapshot.body}
        sampleRecipient={null}
        brandName={snapshot.brandName}
        brandLogoUrl={snapshot.brandLogoUrl}
        // G20 — preview substitutes {{survey_title}} against the operator's
        // surveyNameInMail. Fall back to subject only for pre-G20 batches.
        surveyTitle={snapshot.surveyNameInMail ?? snapshot.subject}
        surveyId={surveyId}
        theme={previewTheme}
      />
    </section>
  )
}
