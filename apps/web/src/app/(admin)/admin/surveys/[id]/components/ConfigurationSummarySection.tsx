// Issue #241 Slice 4a — Spec §7 Configuration summary section.
// Renders <PreviewSurvey> on the left (R28: "actual rendered survey form")
// and <SurveyConfigDl> on the right. R28 default expanded when responsesCount===0.

'use client'

import { PreviewSurvey } from '@/components/survey-form/PreviewSurvey'
import type { BrandLite, BrandThemeLite, SurveyResolved } from '@/components/survey-form/types'

import { CollapsibleSection } from './CollapsibleSection'
import { SurveyConfigDl } from './SurveyConfigDl'

export interface ConfigurationSummarySectionProps {
  survey: SurveyResolved
  brand: BrandLite
  theme: BrandThemeLite
  programName: string | null
  responsesCount: number
}

export function ConfigurationSummarySection({
  survey,
  brand,
  theme,
  programName,
  responsesCount,
}: ConfigurationSummarySectionProps) {
  return (
    <CollapsibleSection title="Configuration summary" expandedDefault={responsesCount === 0}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <PreviewSurvey
            survey={survey}
            theme={theme}
            brand={brand}
            channel="standalone"
            viewport="desktop"
            readOnly
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <SurveyConfigDl survey={survey} brand={brand} theme={theme} programName={programName} />
        </div>
      </div>
    </CollapsibleSection>
  )
}
