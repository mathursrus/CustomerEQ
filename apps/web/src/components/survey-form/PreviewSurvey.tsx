// Issue #241 Slice 4a — channel × viewport-aware wrapper around the form renderer.
// Forces mode='preview' (no submit). Read-only is the only mode used by admin
// callers in this slice; the standalone respondent page in Slice 5 will mount
// <SurveyFormRenderer> directly with mode='live'.

import { useState } from 'react'

import { SurveyFormRenderer } from './SurveyFormRenderer'
import type {
  AnswersState,
  BrandLite,
  BrandThemeLite,
  Channel,
  SurveyResolved,
  Viewport,
} from './types'

export interface PreviewSurveyProps {
  survey: SurveyResolved
  theme: BrandThemeLite
  brand: BrandLite
  channel: Channel
  viewport: Viewport
  readOnly?: boolean
  initialAnswers?: AnswersState
}

const VIEWPORT_MAX_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  mobile: '375px',
}

export function PreviewSurvey({
  survey,
  theme,
  brand,
  channel,
  viewport,
  readOnly,
  initialAnswers,
}: PreviewSurveyProps) {
  const [answers, setAnswers] = useState<AnswersState>(initialAnswers ?? {})
  return (
    <div
      data-viewport={viewport}
      data-channel={channel}
      style={{
        maxWidth: VIEWPORT_MAX_WIDTH[viewport],
        margin: '0 auto',
      }}
    >
      <SurveyFormRenderer
        survey={survey}
        theme={theme}
        brand={brand}
        channel={channel}
        viewport={viewport}
        mode="preview"
        readOnly={readOnly}
        answers={answers}
        onAnswerChange={(qid, value) => setAnswers((prev) => ({ ...prev, [qid]: value }))}
      />
    </div>
  )
}
