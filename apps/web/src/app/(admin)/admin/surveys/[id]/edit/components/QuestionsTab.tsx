// Issue #241 Slice 4b (#336) — QuestionsTab (full implementation, §J item 6).
//
// Per Spec §2.2 / R6 and RFC §"Question canvas":
//   - Palette exposes the 11 non-legacy question types (legacy 'choice' is
//     intentionally hidden from operators; it stays in the schema for
//     back-compat per packages/shared/src/zod/survey.schema.ts:5-10).
//   - Per-question card with Up / Down reorder buttons (no @dnd-kit; the
//     §G anti-pattern explicitly rejects drag-drop dependencies).
//   - Right-rail config panel (text, type, required) reveals when a card is
//     selected — keeps the canvas readable when many questions are present.
//   - Preset banner renders for NPS / CSAT / CES so the operator knows the
//     question set started from a preset (R6 swap behavior is driven from
//     BasicsTab; this tab only surfaces the "you're editing a preset" hint).
//   - CUSTOM with zero questions renders an empty-state hint pointing the
//     operator at the palette.

'use client'

import { useState } from 'react'

import type { SurveyQuestion } from '@customerEQ/shared'

import type { EditorSurvey } from '../__fixtures__/editor-fixtures'

// Operator-facing palette. Legacy 'choice' deliberately excluded — operators
// reach for the more-specific multiple_choice / checkbox / dropdown types.
type PaletteType = Exclude<SurveyQuestion['type'], 'choice'>

const PALETTE: Array<{ value: PaletteType; label: string }> = [
  { value: 'rating', label: 'Rating' },
  { value: 'text', label: 'Text' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'slider', label: 'Slider' },
  { value: 'likert', label: 'Likert' },
  { value: 'image_choice', label: 'Image choice' },
  { value: 'file_upload', label: 'File upload' },
]

function makeId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`
}

function defaultQuestionFor(type: PaletteType): SurveyQuestion {
  const base = { id: makeId(), type, text: 'New question', required: true }
  switch (type) {
    case 'rating':
      return { ...base, config: { min: 0, max: 10 } }
    case 'slider':
      return { ...base, config: { min: 0, max: 100, step: 1 } }
    case 'multiple_choice':
    case 'checkbox':
    case 'dropdown':
    case 'ranking':
      return { ...base, config: { options: ['Option 1', 'Option 2'] } }
    case 'matrix':
      return {
        ...base,
        config: { rows: ['Row 1', 'Row 2'], columns: ['Col 1', 'Col 2'] },
      }
    case 'likert':
      return {
        ...base,
        config: {
          scale: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
        },
      }
    case 'image_choice':
      return { ...base, config: { imageOptions: [] } }
    case 'file_upload':
      return { ...base, config: { maxSizeMB: 5 } }
    case 'text':
      return { ...base, config: { multiline: false } }
  }
}

export interface QuestionsTabProps {
  survey: EditorSurvey
  onChange: (questions: SurveyQuestion[]) => void
  disabled: boolean
}

export function QuestionsTab({ survey, onChange, disabled }: QuestionsTabProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const showPresetBanner =
    survey.type === 'NPS' || survey.type === 'CSAT' || survey.type === 'CES'

  function commit(next: SurveyQuestion[]) {
    setQuestions(next)
    onChange(next)
  }

  function handleAddType(type: PaletteType) {
    if (disabled) return
    commit([...questions, defaultQuestionFor(type)])
  }

  function handleMoveUp(idx: number) {
    if (disabled || idx === 0) return
    const next = [...questions]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    commit(next)
  }

  function handleMoveDown(idx: number) {
    if (disabled || idx === questions.length - 1) return
    const next = [...questions]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    commit(next)
  }

  function handleTextChange(idx: number, value: string) {
    const next = [...questions]
    next[idx] = { ...next[idx], text: value }
    commit(next)
  }

  function handleRequiredChange(idx: number, value: boolean) {
    const next = [...questions]
    next[idx] = { ...next[idx], required: value }
    commit(next)
  }

  function handleDelete(idx: number) {
    if (disabled) return
    const removed = questions[idx]
    const next = questions.filter((_, i) => i !== idx)
    if (selectedId === removed.id) setSelectedId(null)
    commit(next)
  }

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  const selectedIdx =
    selectedId !== null ? questions.findIndex((q) => q.id === selectedId) : -1
  const selected = selectedIdx >= 0 ? questions[selectedIdx] : null

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        {showPresetBanner && (
          <div
            data-testid="preset-banner"
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900"
          >
            <span className="font-semibold">{survey.type} preset.</span>{' '}
            The questions below are the preset starting point — edit or add to
            tailor this survey.
          </div>
        )}

        <div
          data-testid="question-palette"
          className="rounded-md border border-gray-200 bg-white p-3"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Add question
          </p>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button
                key={p.value}
                type="button"
                data-testid={`palette-type-${p.value}`}
                disabled={disabled}
                onClick={() => handleAddType(p.value)}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {questions.length === 0 ? (
          <div
            data-testid="questions-empty-state"
            className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500"
          >
            No questions yet — pick a type from the palette to add one.
          </div>
        ) : (
          <ul className="space-y-2">
            {questions.map((q, i) => {
              const isSelected = q.id === selectedId
              return (
                <li
                  key={q.id}
                  data-testid={`question-card-${q.id}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelect(q.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect(q.id)
                    }
                  }}
                  className={`cursor-pointer rounded-md border bg-white p-3 transition-colors ${
                    isSelected
                      ? 'border-indigo-500 ring-1 ring-indigo-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={disabled || i === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveUp(i)
                        }}
                        className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={disabled || i === questions.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDown(i)
                        }}
                        className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {q.type}
                        </span>
                        {q.required && (
                          <span className="text-[10px] uppercase text-red-500">
                            required
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-900">
                        {q.text || <em className="text-gray-400">(no text)</em>}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete question ${i + 1}`}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(i)
                      }}
                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selected && selectedIdx >= 0 && (
        <aside
          data-testid="question-config-panel"
          className="self-start space-y-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <h3 className="text-sm font-semibold text-gray-900">Question settings</h3>
          <div>
            <label
              htmlFor="rail-question-text"
              className="block text-xs font-medium text-gray-700"
            >
              Question text
            </label>
            <textarea
              id="rail-question-text"
              rows={2}
              value={selected.text}
              disabled={disabled}
              onChange={(e) => handleTextChange(selectedIdx, e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-700">Type</span>
            <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700">
              {selected.type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="rail-question-required"
              type="checkbox"
              checked={selected.required}
              disabled={disabled}
              onChange={(e) => handleRequiredChange(selectedIdx, e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
              htmlFor="rail-question-required"
              className="text-sm text-gray-700"
            >
              Required
            </label>
          </div>
        </aside>
      )}
    </div>
  )
}
