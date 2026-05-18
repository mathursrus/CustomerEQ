// Issue #241 Slice 4a — Spec §7 Distribution section.
// Three tiles, left → right: Send via my email tool (#378 primary CTA),
// Embed snippet (Copy), Share link (Copy). Order is intentional — the
// per-recipient flow is the preferred distribution mode for #378, so it
// occupies the left slot to draw the operator's eye first.
// R27 default-expanded when responsesCount === 0.
//
// Round-2 feedback (#335 post-merge testing):
//  - QR code + Email integration tiles removed. They were "Coming soon"
//    stubs that cluttered the UI; will be reintroduced as real tiles when
//    each feature is implemented under its own sub-issue.
//  - DRAFT surveys now display a warning banner above the tiles since the
//    public route (apps/api/src/routes/public.ts) only serves ACTIVE
//    surveys — DRAFT share / embed URLs 404 with "Survey not found". The
//    banner sets expectations; the URLs themselves remain visible so
//    operators can preview the format and stage their integration.
//  - Embed snippet now includes the three brand-populated data-prefill
//    attributes mandated by spec R16 A1: the member identifier (one of
//    email / external-id / phone, selected by `brand.memberIdentifierKind`)
//    plus first-name and last-name. Brands replace the placeholder values
//    with their server-side templating. Snippet runtime semantics are
//    Slice 5's responsibility; this is the documentation surface.

'use client'

import { useState, type ReactNode } from 'react'

import { CollapsibleSection } from './CollapsibleSection'

type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'
type MemberIdentifierKind = 'email' | 'phone' | 'external_id'

export interface DistributionSectionProps {
  surveyId: string
  status: SurveyStatus
  responsesCount: number
  apiUrl: string
  memberIdentifierKind: MemberIdentifierKind
}

function CopyTile({
  icon,
  title,
  description,
  value,
  copyAriaLabel,
  footer,
}: {
  icon: ReactNode
  title: string
  description: string
  value: string
  copyAriaLabel: string
  footer?: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — leave the value visible so the operator can manually select.
    }
  }
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      <p className="mt-1 text-xs text-gray-600">{description}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyAriaLabel}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="mt-2 max-h-24 overflow-auto rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap break-all">
        <code>{value}</code>
      </pre>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  )
}

// Maps brand.memberIdentifierKind to the data-prefill attribute name per spec R16 A1.
// 'external_id' uses the kebab-case attribute name to match the schema (`data-prefill-external-id`).
function dataPrefillAttrFor(kind: MemberIdentifierKind): { attr: string; label: string } {
  switch (kind) {
    case 'email':
      return { attr: 'data-prefill-email', label: 'MEMBER_EMAIL' }
    case 'phone':
      return { attr: 'data-prefill-phone', label: 'MEMBER_PHONE' }
    case 'external_id':
      return { attr: 'data-prefill-external-id', label: 'MEMBER_EXTERNAL_ID' }
  }
}

// Issue #378 — primary action that routes to the per-recipient links page.
// Rendered as the right-most tile in the 3-column dist-tiles grid (matches the
// Round-2 mock at docs/feature-specs/mocks/378-distribute-flow.html scene 1).
function SendViaEmailToolTile({ surveyId, status }: { surveyId: string; status: SurveyStatus }) {
  const isActive = status === 'ACTIVE'
  const disabledTooltip =
    status === 'DRAFT'
      ? 'Activate the survey before distributing'
      : status === 'PAUSED'
        ? 'Resume the survey to distribute'
        : status === 'STOPPED'
          ? 'This survey is stopped — Restart to distribute'
          : ''

  return (
    <div
      className={`flex flex-col rounded-lg border-2 p-4 ${
        isActive ? 'border-indigo-300 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
        <span aria-hidden>📧</span>
        Send via my email tool
      </h3>
      <p className="mt-1 text-xs text-gray-600">
        Generate per-recipient links for mail-merge applications like Mailchimp, or send individual
        mails.
      </p>
      <div className="mt-auto pt-4">
        {isActive ? (
          <a
            href={`/admin/surveys/${surveyId}/distribute`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Send via my email tool →
          </a>
        ) : (
          <span
            aria-disabled
            title={disabledTooltip}
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400"
          >
            Send via my email tool →
          </span>
        )}
      </div>
    </div>
  )
}

function buildEmbedSnippet(apiUrl: string, surveyId: string, kind: MemberIdentifierKind): string {
  const { attr, label } = dataPrefillAttrFor(kind)
  return [
    `<script src="${apiUrl}/v1/public/surveys/${surveyId}/widget.js"`,
    `  data-survey="${surveyId}"`,
    `  ${attr}="{{${label}}}"`,
    `  data-prefill-first-name="{{FIRST_NAME}}"`,
    `  data-prefill-last-name="{{LAST_NAME}}"></script>`,
  ].join('\n')
}

export function DistributionSection({
  surveyId,
  status,
  responsesCount,
  apiUrl,
  memberIdentifierKind,
}: DistributionSectionProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareLink = `${origin}/survey/${surveyId}`
  const embedSnippet = buildEmbedSnippet(apiUrl, surveyId, memberIdentifierKind)
  const isDraft = status === 'DRAFT'

  return (
    <CollapsibleSection title="Distribution" expandedDefault={responsesCount === 0}>
      {isDraft ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="font-medium">Survey is in DRAFT.</span>{' '}
          The share link and embed snippet below will not respond until you activate the survey. The
          formats are stable, so you can stage integrations before activation.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Issue #378 — primary tile placed first (left) to drive operators toward
            the per-recipient flow over the share link. State-aware: disabled for
            non-ACTIVE surveys with a tooltip keyed to the state (R2). */}
        <SendViaEmailToolTile surveyId={surveyId} status={status} />
        <CopyTile
          icon="🧩"
          title="Embed snippet"
          description="Paste this script into your own page; CustomerEQ renders inline."
          value={embedSnippet}
          copyAriaLabel="Copy embed snippet"
          footer={
            <span className="text-[11px] text-gray-500">
              Replace <code className="rounded bg-gray-100 px-1">{`{{...}}`}</code> with values your
              host page templates server-side (member identifier:{' '}
              <code className="rounded bg-gray-100 px-1">{memberIdentifierKind}</code>).
            </span>
          }
        />
        <CopyTile
          icon="🔗"
          title="Share link"
          description="Post the URL anywhere — social, blog, signage."
          value={shareLink}
          copyAriaLabel="Copy share link"
        />
      </div>
    </CollapsibleSection>
  )
}
