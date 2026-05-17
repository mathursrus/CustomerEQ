// Issue #241 Slice 4a — Spec §7 Distribution section.
// Two tiles: Share link (Copy), Embed snippet (Copy).
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

import { useState } from 'react'

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
  label,
  value,
  copyAriaLabel,
}: {
  label: string
  value: string
  copyAriaLabel: string
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 whitespace-pre-wrap break-all">
          <code>{value}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyAriaLabel}
          className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
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

  const tile = (
    <div
      className={`mt-4 rounded-lg border p-4 ${
        isActive
          ? 'border-indigo-200 bg-indigo-50'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Send via my email tool →</p>
          <p className="mt-1 text-xs text-gray-600">
            Generate per-recipient links for mail-merge applications like Mailchimp, or use the
            links to send individual mails.
          </p>
        </div>
        {isActive ? (
          <a
            href={`/admin/surveys/${surveyId}/distribute`}
            className="flex-shrink-0 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Open
          </a>
        ) : (
          <span
            aria-disabled
            title={disabledTooltip}
            className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
          >
            Open
          </span>
        )}
      </div>
    </div>
  )
  return tile
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CopyTile label="Share link" value={shareLink} copyAriaLabel="Copy share link" />
        <CopyTile label="Embed snippet" value={embedSnippet} copyAriaLabel="Copy embed snippet" />
      </div>
      {/* Issue #378 — third tile: Send via my email tool. Routes to the
          per-recipient links generator. State-aware: disabled for non-ACTIVE
          surveys with a tooltip keyed to the state (R2). */}
      <SendViaEmailToolTile surveyId={surveyId} status={status} />
      <p className="mt-3 text-xs text-gray-500">
        Replace the <code className="rounded bg-gray-100 px-1">{`{{...}}`}</code> placeholders in the
        embed snippet with values templated server-side by your host page. The member identifier
        attribute follows your brand&apos;s configured member-identifier kind
        (<code className="rounded bg-gray-100 px-1">{memberIdentifierKind}</code>); first-name and
        last-name are optional.
      </p>
    </CollapsibleSection>
  )
}
