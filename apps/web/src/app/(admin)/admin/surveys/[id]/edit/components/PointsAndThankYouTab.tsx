// Issue #241 Slice 4b (#336) — PointsAndThankYouTab full impl (§J item 8).
//
// Surface per spec §2.4 / R20 / R21:
//   - Read-only program-rate display sourced from
//     EarningRule(programId, cxEventForType(survey.type)).
//   - "No points configured for <type>" fallback when no rule matches.
//   - V1 per-survey override slot reserved (empty DOM marker, no UI).
//   - Thank-you variable picker offers EXACTLY 3 chips:
//     {{points}} · {{pointCurrencyName}} · {{rewardLink}}.
//   - Thank-you redirect URL input + hint that it is honored on standalone only.

'use client'

import { useRef } from 'react'

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

const VARIABLE_CHIPS = [
  { key: 'points', token: '{{points}}', label: 'Points' },
  { key: 'pointCurrencyName', token: '{{pointCurrencyName}}', label: 'Point name' },
  { key: 'rewardLink', token: '{{rewardLink}}', label: 'Reward link' },
] as const

function cxEventForType(type: EditorSurvey['type']): 'NPS' | 'CSAT' | 'CES' | 'CUSTOM' {
  return type
}

export function PointsAndThankYouTab({
  survey,
  program,
  onChange,
  disabled,
}: PointsAndThankYouTabProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const cxEvent = cxEventForType(survey.type)
  const rule = program?.earningRules.find((r) => r.cxEventForType === cxEvent)
  const currency = program?.pointCurrencyName ?? 'points'

  function insertToken(token: string) {
    const current = survey.thankYouMessage ?? ''
    const el = textareaRef.current
    let next: string
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd ?? start
      next = current.slice(0, start) + token + current.slice(end)
    } else {
      next = current + token
    }
    onChange({ thankYouMessage: next })
  }

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">Points earned</h3>
        <div
          data-testid="program-rate-display"
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
        >
          {rule ? (
            <>
              <span className="font-semibold tabular-nums">{rule.pointsAwarded}</span>{' '}
              <span className="text-gray-600">{currency}</span>{' '}
              <span className="text-gray-500">
                awarded when a respondent completes this {survey.type} survey.
              </span>
            </>
          ) : (
            <span className="text-gray-500">
              No points configured for {survey.type}. Set up an EarningRule for{' '}
              <span className="font-medium">{survey.type}</span> on this program to award points.
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          To change this rate, edit the program&apos;s earning rules. Per-survey overrides arrive in a
          future release.
        </p>
        {/* V1 hook — reserved layout slot per R20 (empty by design). */}
        <div data-testid="points-override-slot" />
      </section>

      <section className="space-y-2">
        <label
          htmlFor="thank-you-message"
          className="block text-sm font-medium text-gray-900"
        >
          Thank-you message
        </label>
        <div
          data-testid="thank-you-variable-picker"
          className="flex flex-wrap gap-2"
        >
          {VARIABLE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              data-testid={`variable-chip-${chip.key}`}
              data-variable={chip.key}
              onClick={() => insertToken(chip.token)}
              disabled={disabled}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chip.label} <code className="font-mono text-[10px]">{chip.token}</code>
            </button>
          ))}
        </div>
        <textarea
          id="thank-you-message"
          ref={textareaRef}
          aria-label="Thank-you message"
          rows={4}
          value={survey.thankYouMessage ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ thankYouMessage: e.target.value })}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </section>

      <section className="space-y-2">
        <label
          htmlFor="thank-you-redirect-url"
          className="block text-sm font-medium text-gray-900"
        >
          Thank-you redirect URL
        </label>
        <input
          id="thank-you-redirect-url"
          type="url"
          aria-label="Thank-you redirect URL"
          value={survey.thankYouRedirectUrl ?? ''}
          disabled={disabled}
          placeholder="https://your-site.example/thanks"
          onChange={(e) => onChange({ thankYouRedirectUrl: e.target.value || null })}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
        />
        <p className="text-xs text-gray-500">
          Only honored on the <span className="font-medium">standalone</span> survey link. The
          embedded widget ignores this field.
        </p>
      </section>
    </div>
  )
}
