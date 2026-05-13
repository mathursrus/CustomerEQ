// Issue #241 Slice 4a — Spec §7 Loop Monitor section.
//
// Originally embedded inside ResponseSection (Slice 4a postmortem commit
// 40b0419). Round-2 feedback (#335 post-merge testing): the hero pipeline
// (Issue #80, project rule R2) needs first-class visibility on the detail
// page, not buried behind a default-collapsed Response section. Promoted
// to its own section between Distribution and Response. ResponseSection
// reverts to a deferred-analytics placeholder block.
//
// Default-expanded for all surveyStatus values. LoopMonitor itself renders
// a placeholder shell for DRAFT (per existing LoopMonitor behavior — see
// `apps/web/src/components/surveys/LoopMonitor.tsx`) so the section is
// useful pre-activation as well as post-activation.

'use client'

import LoopMonitor from '@/components/surveys/LoopMonitor'

import { CollapsibleSection } from './CollapsibleSection'

export interface LoopMonitorSectionProps {
  surveyId: string
  surveyStatus: string
  getToken: () => Promise<string | null>
}

export function LoopMonitorSection({ surveyId, surveyStatus, getToken }: LoopMonitorSectionProps) {
  return (
    <CollapsibleSection title="Loop Monitor" expandedDefault={true}>
      <LoopMonitor surveyId={surveyId} surveyStatus={surveyStatus} getToken={getToken} />
    </CollapsibleSection>
  )
}
