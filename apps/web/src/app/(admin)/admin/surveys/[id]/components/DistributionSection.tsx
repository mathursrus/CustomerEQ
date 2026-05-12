// Issue #241 Slice 4a — Spec §7 Distribution section.
// 4 tiles: Share link (Copy), Embed snippet (Copy), Email integration (stub),
// QR code (stub). R27 default-expanded when responsesCount === 0.

'use client'

import { useState } from 'react'

import { CollapsibleSection } from './CollapsibleSection'

type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'

export interface DistributionSectionProps {
  surveyId: string
  status: SurveyStatus
  responsesCount: number
  apiUrl: string
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
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 break-all">
          {value}
        </code>
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

function StubTile({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">Coming soon</p>
    </div>
  )
}

export function DistributionSection({ surveyId, status, responsesCount, apiUrl }: DistributionSectionProps) {
  void status // status will gate UI affordances in future iterations
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareLink = `${origin}/survey/${surveyId}`
  const embedSnippet = `<script src="${apiUrl}/v1/public/surveys/${surveyId}/widget.js"></script>`

  return (
    <CollapsibleSection title="Distribution" expandedDefault={responsesCount === 0}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CopyTile label="Share link" value={shareLink} copyAriaLabel="Copy share link" />
        <CopyTile label="Embed snippet" value={embedSnippet} copyAriaLabel="Copy embed snippet" />
        <StubTile
          label="Email integration"
          description="Send the survey to a member segment from your email provider."
        />
        <StubTile
          label="QR code"
          description="Print a QR that resolves to the public survey URL."
        />
      </div>
    </CollapsibleSection>
  )
}
