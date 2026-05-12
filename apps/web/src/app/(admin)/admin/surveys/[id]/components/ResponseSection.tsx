// Issue #241 Slice 4a — Spec §7 Response section.
// Default chevron state per R32: collapsed when responsesCount===0, expanded
// when responsesCount>0 (inverse of Distribution and Configuration summary).
//
// The body embeds <LoopMonitor>, the closed-loop feedback-to-loyalty pipeline
// view (Issue #80 — protects the hero <15-min SLA). Other response analytics
// (score distribution, sentiment, topic clusters, individual responses) ship
// under a sibling sub-issue to #235 and slot into this same section body when
// they land.

'use client'

import LoopMonitor from '@/components/surveys/LoopMonitor'

import { CollapsibleSection } from './CollapsibleSection'

export interface ResponseSectionProps {
  surveyId: string
  surveyStatus: string
  responsesCount: number
  getToken: () => Promise<string | null>
}

export function ResponseSection({ surveyId, surveyStatus, responsesCount, getToken }: ResponseSectionProps) {
  return (
    <CollapsibleSection title="Response" expandedDefault={responsesCount > 0}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Response analytics — score distribution, sentiment, topic clusters, and the individual response
          stream — ship under a sibling sub-issue to #235. The pipeline view below covers Issue #80&apos;s
          closed-loop visibility today.
        </p>
        <LoopMonitor surveyId={surveyId} surveyStatus={surveyStatus} getToken={getToken} />
      </div>
    </CollapsibleSection>
  )
}
