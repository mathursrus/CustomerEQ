// Issue #241 Slice 4a — Spec §7 Response section.
// Default chevron state per R32: collapsed when responsesCount===0, expanded
// when responsesCount>0 (inverse of Distribution and Configuration summary).
//
// Round-2 feedback (#335 post-merge testing): <LoopMonitor> was previously
// embedded here (Slice 4a postmortem commit 40b0419) but the hero pipeline
// (Issue #80, project rule R2) needs first-class visibility on the detail
// page, not buried behind a default-collapsed Response section on DRAFT.
// LoopMonitor moved to its own always-default-expanded section — see
// <LoopMonitorSection>. This section's body is now the deferred-analytics
// placeholder only; real analytics (score distribution, sentiment, topic
// clusters, individual response stream) ship under a sibling sub-issue to
// #235 and slot into this section's body when they land.

'use client'

import { CollapsibleSection } from './CollapsibleSection'

export interface ResponseSectionProps {
  surveyId: string
  responsesCount: number
}

export function ResponseSection({ surveyId, responsesCount }: ResponseSectionProps) {
  void surveyId // reserved for future API-backed analytics fetches
  return (
    <CollapsibleSection title="Response" expandedDefault={responsesCount > 0}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Response analytics — score distribution, sentiment, topic clusters, and the individual response
          stream — ship under a sibling sub-issue to #235. The pipeline view in the Loop Monitor section
          above already covers Issue #80&apos;s closed-loop visibility.
        </p>
        {responsesCount === 0 ? (
          <p className="text-xs text-gray-500">
            This section will populate once the survey starts receiving responses.
          </p>
        ) : null}
      </div>
    </CollapsibleSection>
  )
}
