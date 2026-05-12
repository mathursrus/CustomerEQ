// Issue #241 Slice 4a — Spec §7 Response section.
// V0 placeholder block per R32: collapsed when responsesCount===0, expanded
// when responsesCount>0. Real analytics (score distribution, sentiment,
// topics, individual responses, LoopMonitor) ship under a sibling sub-issue.

'use client'

import { CollapsibleSection } from './CollapsibleSection'

export interface ResponseSectionProps {
  responsesCount: number
}

export function ResponseSection({ responsesCount }: ResponseSectionProps) {
  return (
    <CollapsibleSection title="Response" expandedDefault={responsesCount > 0}>
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-2">Response analytics</p>
        <p>
          This is a placeholder block. Score distribution, sentiment, topic clusters, the individual response
          stream, and LoopMonitor land under a sibling sub-issue to #235. In #241 V0 it surfaces only as a
          shell so the section ordering matches the spec.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {responsesCount === 0
            ? 'No responses captured yet.'
            : `${responsesCount} response${responsesCount === 1 ? '' : 's'} collected so far.`}
        </p>
      </div>
    </CollapsibleSection>
  )
}
