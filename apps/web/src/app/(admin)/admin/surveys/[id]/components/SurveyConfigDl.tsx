// Issue #241 Slice 4a — compact dl summary for the Configuration section (R28).

'use client'

import type { BrandLite, BrandThemeLite, SurveyResolved } from '@/components/survey-form/types'

export interface SurveyConfigDlProps {
  survey: SurveyResolved
  brand: BrandLite
  theme: BrandThemeLite
  programName: string | null
}

const STATUS_LABEL: Record<SurveyResolved['status'], string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  STOPPED: 'Stopped',
}

const RESPONSE_POLICY_LABEL: Record<SurveyResolved['responsePolicy'], string> = {
  MULTIPLE: 'Multiple responses',
  ONCE: 'One response per member',
  LATEST_OVERWRITES: 'Latest response overwrites prior',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800">{value}</dd>
    </div>
  )
}

export function SurveyConfigDl({ survey, brand, theme, programName }: SurveyConfigDlProps) {
  void brand // surfaced via the preview pane already; reserved for future binding
  return (
    <dl className="text-sm">
      <Row label="Type" value={survey.type} />
      <Row label="Status" value={STATUS_LABEL[survey.status]} />
      <Row label="Program" value={programName ?? '—'} />
      <Row label="Theme" value={theme.name} />
      <Row label="Response policy" value={RESPONSE_POLICY_LABEL[survey.responsePolicy]} />
      <Row label="Consent" value={survey.consentTextOverride ? 'Override active' : 'Inherits brand default'} />
      <Row
        label="Thank-you copy"
        value={survey.thankYouMessage.length > 80 ? `${survey.thankYouMessage.slice(0, 80)}…` : survey.thankYouMessage}
      />
    </dl>
  )
}
