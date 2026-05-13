// Issue #241 Slice 4b (#336) — PointsAndThankYouTab stub.
// Walking-skeleton placeholder for Phase 4 Item 8 (deferred to next session).
// Full implementation: read-only program rate (R20) + variable picker (R21) +
// thank-you redirect URL.
//
// Walking-skeleton surface (used by SurveyEditorForm tests this session):
//   - thank-you message textarea wired through onChange so per-tab dirty
//     tracking works in the SurveyEditorForm test.

'use client'

import type {
  EditorSurvey,
  ProgramWithEarningRule,
} from '../__fixtures__/editor-fixtures'

export interface PointsAndThankYouTabProps {
  survey: EditorSurvey
  program: ProgramWithEarningRule | undefined
  onChange: (patch: { thankYouMessage?: string; thankYouRedirectUrl?: string | null }) => void
  disabled: boolean
}

export function PointsAndThankYouTab({
  survey,
  onChange,
  disabled,
}: PointsAndThankYouTabProps) {
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-gray-500">
        Points &amp; Thank You — read-only rate + variable picker land in
        Phase 4 Item 8 (next session).
      </p>

      <div>
        <label
          htmlFor="thank-you-message"
          className="block text-sm font-medium text-gray-900"
        >
          Thank-you message
        </label>
        <textarea
          id="thank-you-message"
          aria-label="Thank-you message"
          rows={3}
          value={survey.thankYouMessage ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ thankYouMessage: e.target.value })}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>
    </div>
  )
}
