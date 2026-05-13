// Issue #241 Slice 4b (#336) — QuestionsTab stub.
// Walking-skeleton placeholder for Phase 4 Item 6 (deferred to next session).
// Full implementation: 11 question types + Up/Down reorder + preset banner.

'use client'

import type { SurveyQuestion } from '@customerEQ/shared'

import type { EditorSurvey } from '../__fixtures__/editor-fixtures'

export interface QuestionsTabProps {
  survey: EditorSurvey
  onChange: (questions: SurveyQuestion[]) => void
  disabled: boolean
}

export function QuestionsTab({ survey, disabled }: QuestionsTabProps) {
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-gray-500">
        Question canvas — full editor lands in Phase 4 Item 6 (next session).
      </p>
      <ul className="list-disc pl-5 text-sm text-gray-700">
        {survey.questions.map((q) => (
          <li key={q.id}>
            <span className="font-medium">{q.type}</span>
            {' — '}
            {q.text}
          </li>
        ))}
      </ul>
      {disabled && (
        <p className="text-xs italic text-gray-400">Read-only (survey is stopped).</p>
      )}
    </div>
  )
}
