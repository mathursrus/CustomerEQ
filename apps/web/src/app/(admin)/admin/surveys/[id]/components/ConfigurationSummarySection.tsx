// Issue #241 Slice 4a — Spec §7 Configuration summary section.
// Renders <PreviewSurvey> on the left (R28: "actual rendered survey form")
// and <SurveyConfigDl> on the right. R28 default expanded when
// responsesCount===0.
//
// Round-2 feedback (#335 post-merge testing): the bare PreviewSurvey was
// not clearly labeled as a customer-facing preview — users mistook it for
// a different surface. Added an explicit "Survey preview — what your
// customers will see" header on the left and a "Configuration" header on
// the right so the two columns read as preview + summary, not as two
// equivalent renderings.

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
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Survey preview</h3>
            <p className="text-xs text-gray-500">What your customers will see when they open this survey.</p>
          </div>
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
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Configuration</h3>
            <p className="text-xs text-gray-500">The settings that produced the preview on the left.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <SurveyConfigDl survey={survey} brand={brand} theme={theme} programName={programName} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
