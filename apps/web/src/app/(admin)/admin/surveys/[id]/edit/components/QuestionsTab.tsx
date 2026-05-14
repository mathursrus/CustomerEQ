// Issue #241 Slice 4b (#336) — QuestionsTab (full implementation, §J item 6).
//
// Per Spec §2.2 / R6 / RFC §"Question canvas" and §"Primary score field
// resolution":
//   - Left palette: 11 question types with icon + label (mock 241 source of
//     truth: lines 714–724).
//   - Per-question card with Up / Down reorder buttons (no @dnd-kit; the
//     §G anti-pattern explicitly rejects drag-drop dependencies).
//   - Right-rail config panel: General (text / required) + per-type config
//     (Survey-Builder parity per legacy `/admin/survey-builder` deleted in
//     d8a730d) + Scoring (isScoreField toggle for rating/slider only;
//     at-most-one enforced by SurveyQuestionSchema validateScoreFields).
//   - Preset banner renders for NPS / CSAT / CES so the operator knows the
//     question set started from a preset.
//   - CUSTOM with zero questions renders an empty-state hint pointing the
//     operator at the palette.
'use client'

import { useState } from 'react'

import type { QuestionConfig, SkipCondition, SkipRule, SurveyQuestion } from '@customerEQ/shared'

import type { EditorSurvey } from '../__fixtures__/editor-fixtures'

// Operator-facing palette. Legacy 'choice' deliberately excluded — operators
// reach for the more-specific multiple_choice / checkbox / dropdown types.
type PaletteType = Exclude<SurveyQuestion['type'], 'choice'>

const PALETTE: Array<{ value: PaletteType; label: string; icon: string }> = [
  { value: 'rating', label: 'Rating', icon: '⭐' },
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'multiple_choice', label: 'Multiple choice', icon: '☑' },
  { value: 'checkbox', label: 'Checkbox', icon: '☐' },
  { value: 'dropdown', label: 'Dropdown', icon: '▾' },
  { value: 'matrix', label: 'Matrix', icon: '📋' },
  { value: 'ranking', label: 'Ranking', icon: '↕' },
  { value: 'slider', label: 'Slider', icon: '📈' },
  { value: 'likert', label: 'Likert', icon: '📊' },
  { value: 'image_choice', label: 'Image choice', icon: '🖼' },
  { value: 'file_upload', label: 'File upload', icon: '📤' },
]

// Types where isScoreField is allowed. Mirrors SCORE_FIELD_RATEABLE_TYPES
// in packages/shared/src/zod/survey.schema.ts:72.
const SCOREABLE_TYPES: ReadonlySet<PaletteType> = new Set(['rating', 'slider'])

function makeId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`
}

function defaultQuestionFor(type: PaletteType): SurveyQuestion {
  const base = { id: makeId(), type, text: 'New question', required: true }
  switch (type) {
    case 'rating':
      return { ...base, config: { min: 0, max: 10, labels: { left: '', right: '' } } }
    case 'slider':
      return { ...base, config: { min: 0, max: 100, step: 1, labels: { left: '', right: '' } } }
    case 'multiple_choice':
    case 'checkbox':
    case 'dropdown':
      return { ...base, config: { options: ['Option 1', 'Option 2'], allowOther: false } }
    case 'ranking':
      return { ...base, config: { options: ['Item 1', 'Item 2'] } }
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
      return { ...base, config: { imageOptions: [], multiSelect: false } }
    case 'file_upload':
      return { ...base, config: { maxSizeMB: 5, allowedTypes: [] } }
    case 'text':
      return { ...base, config: { placeholder: '', maxLength: 500, multiline: false } }
  }
}

function paletteFor(type: SurveyQuestion['type']): { label: string; icon: string } {
  const found = PALETTE.find((p) => p.value === type)
  if (found) return { label: found.label, icon: found.icon }
  // Legacy 'choice' falls through to a neutral display label.
  return { label: type, icon: '◉' }
}

export interface QuestionsTabProps {
  survey: EditorSurvey
  onChange: (questions: SurveyQuestion[]) => void
  disabled: boolean
}

export function QuestionsTab({ survey, onChange, disabled: parentDisabled }: QuestionsTabProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const showPresetBanner =
    survey.type === 'NPS' || survey.type === 'CSAT' || survey.type === 'CES'
  const scoreFieldHolderId = questions.find((q) => q.isScoreField === true)?.id ?? null
  // Per spec §State transitions line 167 ("Pause for time-bounded edits…
  // changing questions on a live survey without losing accumulated responses")
  // and the server FIELD_EDITABILITY: questions are editable in DRAFT or
  // PAUSED only. On ACTIVE / STOPPED the tab is read-only — banner tells the
  // operator how to unlock it. We merge with the parent's `disabled` prop
  // here so every downstream `disabled={disabled}` (palette, cards, right
  // rail) reads the effective lock state without changing each call site.
  const questionsEditable = survey.status === 'DRAFT' || survey.status === 'PAUSED'
  const disabled = parentDisabled || !questionsEditable

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

  function patchQuestion(idx: number, patch: Partial<SurveyQuestion>) {
    const next = [...questions]
    next[idx] = { ...next[idx], ...patch }
    commit(next)
  }

  function patchConfig(idx: number, configPatch: Partial<NonNullable<QuestionConfig>>) {
    const next = [...questions]
    next[idx] = { ...next[idx], config: { ...(next[idx].config ?? {}), ...configPatch } }
    commit(next)
  }

  function handleDelete(idx: number) {
    if (disabled) return
    const removed = questions[idx]
    const next = questions.filter((_, i) => i !== idx)
    if (selectedId === removed.id) setSelectedId(null)
    commit(next)
  }

  function handleDuplicate(idx: number) {
    if (disabled) return
    const src = questions[idx]
    // Clone and assign a fresh id; preserve isScoreField=false so the
    // duplicate doesn't collide with the source's at-most-one score-field
    // invariant (validateScoreFields in survey.schema.ts:74).
    const clone: SurveyQuestion = {
      ...src,
      id: makeId(),
      isScoreField: false,
    }
    const next = [...questions.slice(0, idx + 1), clone, ...questions.slice(idx + 1)]
    commit(next)
  }

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  function handleScoreFieldToggle(idx: number, next: boolean) {
    if (disabled) return
    // Enforce at-most-one client-side so the operator sees the toggle behavior
    // they expect without round-tripping a 422.
    const updated = questions.map((q, i) => {
      if (i === idx) return { ...q, isScoreField: next }
      if (next && q.isScoreField) return { ...q, isScoreField: false }
      return q
    })
    commit(updated)
  }

  const selectedIdx =
    selectedId !== null ? questions.findIndex((q) => q.id === selectedId) : -1
  const selected = selectedIdx >= 0 ? questions[selectedIdx] : null

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[200px_1fr_300px]">
      {/* Palette — left column, icon + label per mock §241 lines 714–724. */}
      <aside
        data-testid="question-palette"
        className="self-start rounded-md border border-gray-200 bg-white p-3"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Add question
        </p>
        <div className="flex flex-col gap-1">
          {PALETTE.map((p) => (
            <button
              key={p.value}
              type="button"
              data-testid={`palette-type-${p.value}`}
              disabled={disabled}
              onClick={() => handleAddType(p.value)}
              className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true" className="text-base">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Canvas — center column. */}
      <div className="space-y-3">
        {!questionsEditable && survey.status === 'ACTIVE' && (
          <div
            data-testid="questions-locked-banner"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            This survey is live. <strong>Pause</strong> it before changing
            questions — accumulated responses are kept.
          </div>
        )}
        {!questionsEditable && survey.status === 'STOPPED' && (
          <div
            data-testid="questions-locked-banner"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            This survey is stopped. <strong>Restart</strong> it to make changes.
          </div>
        )}
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
              const meta = paletteFor(q.type)
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
                    {/* Grip handle + reorder column per mock §241 lines 266 (.grip)
                        and 732-737. The mock uses ⠿ as the grip glyph; we
                        keep visible up/down arrows because drag-drop is out
                        of scope (§G anti-pattern). */}
                    <div className="flex flex-col items-center gap-1">
                      <span aria-hidden="true" className="font-mono text-sm text-gray-400">⠿</span>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="text-xs font-semibold text-indigo-700"
                        >
                          Q{i + 1} ·
                        </span>
                        <span aria-hidden="true">{meta.icon}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {meta.label}
                        </span>
                        {q.required && (
                          <span className="text-[10px] uppercase text-red-500">
                            required
                          </span>
                        )}
                        {q.isScoreField && (
                          <span
                            data-testid={`score-badge-${q.id}`}
                            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800"
                          >
                            Score
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-900">
                        {q.text || <em className="text-gray-400">(no text)</em>}
                      </p>
                    </div>
                    {/* Action column: duplicate + delete per mock §241 lines 735,
                        740 (.q-actions). Edit (✎) is implicit via card-click
                        selecting + editing in the right rail. */}
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        aria-label={`Duplicate question ${i + 1}`}
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicate(i)
                        }}
                        className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ⎘
                      </button>
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
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* "+ Add question" dashed tile per mock §241 line 743 — secondary
            entry point alongside the palette buttons; lands the new
            question at the bottom of the list. Defaults to 'text' since
            it's the most generic type. */}
        {questions.length > 0 && (
          <button
            type="button"
            data-testid="add-question-tile"
            disabled={disabled}
            onClick={() => handleAddType('text')}
            className="block w-full rounded-md border border-dashed border-gray-300 px-3 py-3 text-center text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add question
          </button>
        )}
      </div>

      {/* Right rail — config panel, only renders when a question is selected. */}
      {selected && selectedIdx >= 0 && (
        <aside
          data-testid="question-config-panel"
          className="self-start space-y-4 rounded-md border border-gray-200 bg-white p-3"
        >
          <h3 className="text-sm font-semibold text-gray-900">Question settings</h3>

          {/* General */}
          <section className="space-y-2">
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
                onChange={(e) => patchQuestion(selectedIdx, { text: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
              />
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-700">Type</span>
              <p className="mt-1 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700">
                <span aria-hidden="true">{paletteFor(selected.type).icon}</span>
                {paletteFor(selected.type).label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rail-question-required"
                type="checkbox"
                checked={selected.required}
                disabled={disabled}
                onChange={(e) => patchQuestion(selectedIdx, { required: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="rail-question-required"
                className="text-sm text-gray-700"
              >
                Required
              </label>
            </div>
          </section>

          {/* Per-type config */}
          <TypeConfigEditor
            question={selected}
            disabled={disabled}
            onConfigChange={(patch) => patchConfig(selectedIdx, patch)}
          />

          {/* Skip logic — show or hide this question based on answers to
              other questions. Renderer (skip-rules.logic.ts) consumes
              skipRules[] at runtime. */}
          <SkipRuleEditor
            question={selected}
            otherQuestions={questions.filter((q) => q.id !== selected.id)}
            disabled={disabled}
            onChange={(rules) => patchQuestion(selectedIdx, { skipRules: rules })}
          />

          {/* Scoring — only for rateable types (rating, slider). */}
          {SCOREABLE_TYPES.has(selected.type as PaletteType) && (
            <section
              data-testid="score-section"
              className="border-t border-gray-100 pt-3"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Scoring
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Only one question per survey can be the score. Used to drive the
                {' '}{survey.type === 'CUSTOM' ? 'survey' : survey.type}{' '}score.
              </p>
              <label className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  data-testid={`rail-isscore-${selected.id}`}
                  checked={selected.isScoreField === true}
                  disabled={disabled}
                  onChange={(e) => handleScoreFieldToggle(selectedIdx, e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Use this question as the primary score
                  {scoreFieldHolderId !== null && scoreFieldHolderId !== selected.id && (
                    <span className="block text-xs text-amber-700">
                      Turning this on will move the score off the current
                      score question.
                    </span>
                  )}
                </span>
              </label>
            </section>
          )}
        </aside>
      )}
    </div>
  )
}

// ─── Per-type config editors ──────────────────────────────────────────────

function TypeConfigEditor({
  question,
  disabled,
  onConfigChange,
}: {
  question: SurveyQuestion
  disabled: boolean
  onConfigChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  const cfg = question.config ?? {}
  switch (question.type) {
    case 'rating':
      return (
        <RangeWithLabels
          min={cfg.min ?? 0}
          max={cfg.max ?? 10}
          left={cfg.labels?.left ?? ''}
          right={cfg.labels?.right ?? ''}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'slider':
      return (
        <SliderEditor
          min={cfg.min ?? 0}
          max={cfg.max ?? 100}
          step={cfg.step ?? 1}
          left={cfg.labels?.left ?? ''}
          right={cfg.labels?.right ?? ''}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'text':
      return (
        <TextEditor
          placeholder={cfg.placeholder ?? ''}
          maxLength={cfg.maxLength ?? 500}
          multiline={cfg.multiline ?? false}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'multiple_choice':
    case 'checkbox':
    case 'dropdown':
      return (
        <OptionsWithOther
          options={cfg.options ?? []}
          allowOther={cfg.allowOther ?? false}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'ranking':
      return (
        <RankingEditor
          options={cfg.options ?? []}
          minSelect={cfg.minSelect}
          maxSelect={cfg.maxSelect}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'matrix':
      return (
        <MatrixEditor
          rows={cfg.rows ?? []}
          columns={cfg.columns ?? []}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'likert':
      return (
        <LikertEditor
          scale={cfg.scale ?? []}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'image_choice':
      return (
        <ImageChoiceEditor
          imageOptions={cfg.imageOptions ?? []}
          multiSelect={cfg.multiSelect ?? false}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    case 'file_upload':
      return (
        <FileUploadEditor
          maxSizeMB={cfg.maxSizeMB ?? 5}
          allowedTypes={cfg.allowedTypes ?? []}
          disabled={disabled}
          onChange={(patch) => onConfigChange(patch)}
        />
      )
    default:
      return null
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h4>
  )
}

function NumberField({
  id,
  label,
  value,
  disabled,
  onChange,
  step = 1,
}: {
  id: string
  label: string
  value: number
  disabled: boolean
  onChange: (next: number) => void
  step?: number
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      <input
        id={id}
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
      />
    </label>
  )
}

function TextField({
  id,
  label,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  disabled: boolean
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
      />
    </label>
  )
}

function StringListEditor({
  testIdPrefix,
  label,
  items,
  addLabel,
  disabled,
  onChange,
}: {
  testIdPrefix: string
  label: string
  items: string[]
  addLabel: string
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  return (
    <section className="space-y-1.5">
      <SectionHeader>{label}</SectionHeader>
      <ul data-testid={`${testIdPrefix}-list`} className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={item}
              disabled={disabled}
              data-testid={`${testIdPrefix}-item-${i}`}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            />
            <button
              type="button"
              aria-label={`Remove ${i + 1}`}
              disabled={disabled || items.length <= 1}
              data-testid={`${testIdPrefix}-remove-${i}`}
              onClick={() => onChange(items.filter((_, k) => k !== i))}
              className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        data-testid={`${testIdPrefix}-add`}
        onClick={() => onChange([...items, `${addLabel} ${items.length + 1}`])}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add {addLabel.toLowerCase()}
      </button>
    </section>
  )
}

function RangeWithLabels({
  min,
  max,
  left,
  right,
  disabled,
  onChange,
}: {
  min: number
  max: number
  left: string
  right: string
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-3">
      <SectionHeader>Rating scale</SectionHeader>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id="rail-rating-min"
          label="Min"
          value={min}
          disabled={disabled}
          onChange={(n) => onChange({ min: n })}
        />
        <NumberField
          id="rail-rating-max"
          label="Max"
          value={max}
          disabled={disabled}
          onChange={(n) => onChange({ max: n })}
        />
      </div>
      <SectionHeader>Endpoint labels</SectionHeader>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          id="rail-rating-label-left"
          label="Left"
          value={left}
          disabled={disabled}
          placeholder="Not at all"
          onChange={(v) => onChange({ labels: { left: v, right } })}
        />
        <TextField
          id="rail-rating-label-right"
          label="Right"
          value={right}
          disabled={disabled}
          placeholder="Extremely"
          onChange={(v) => onChange({ labels: { left, right: v } })}
        />
      </div>
    </section>
  )
}

function SliderEditor({
  min,
  max,
  step,
  left,
  right,
  disabled,
  onChange,
}: {
  min: number
  max: number
  step: number
  left: string
  right: string
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-3">
      <SectionHeader>Slider range</SectionHeader>
      <div className="grid grid-cols-3 gap-2">
        <NumberField
          id="rail-slider-min"
          label="Min"
          value={min}
          disabled={disabled}
          onChange={(n) => onChange({ min: n })}
        />
        <NumberField
          id="rail-slider-max"
          label="Max"
          value={max}
          disabled={disabled}
          onChange={(n) => onChange({ max: n })}
        />
        <NumberField
          id="rail-slider-step"
          label="Step"
          value={step}
          disabled={disabled}
          onChange={(n) => onChange({ step: n })}
        />
      </div>
      <SectionHeader>Endpoint labels</SectionHeader>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          id="rail-slider-label-left"
          label="Left"
          value={left}
          disabled={disabled}
          onChange={(v) => onChange({ labels: { left: v, right } })}
        />
        <TextField
          id="rail-slider-label-right"
          label="Right"
          value={right}
          disabled={disabled}
          onChange={(v) => onChange({ labels: { left, right: v } })}
        />
      </div>
    </section>
  )
}

function TextEditor({
  placeholder,
  maxLength,
  multiline,
  disabled,
  onChange,
}: {
  placeholder: string
  maxLength: number
  multiline: boolean
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-3">
      <SectionHeader>Text answer</SectionHeader>
      <TextField
        id="rail-text-placeholder"
        label="Placeholder"
        value={placeholder}
        disabled={disabled}
        onChange={(v) => onChange({ placeholder: v })}
      />
      <NumberField
        id="rail-text-maxlength"
        label="Max length"
        value={maxLength}
        disabled={disabled}
        onChange={(n) => onChange({ maxLength: n })}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={multiline}
          disabled={disabled}
          onChange={(e) => onChange({ multiline: e.target.checked })}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">Multiline (paragraph)</span>
      </label>
    </section>
  )
}

function OptionsWithOther({
  options,
  allowOther,
  disabled,
  onChange,
}: {
  options: string[]
  allowOther: boolean
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <StringListEditor
        testIdPrefix="rail-options"
        label="Options"
        items={options}
        addLabel="Option"
        disabled={disabled}
        onChange={(next) => onChange({ options: next })}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={allowOther}
          disabled={disabled}
          onChange={(e) => onChange({ allowOther: e.target.checked })}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">Allow “Other” free-text answer</span>
      </label>
    </div>
  )
}

function RankingEditor({
  options,
  minSelect,
  maxSelect,
  disabled,
  onChange,
}: {
  options: string[]
  minSelect?: number
  maxSelect?: number
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <StringListEditor
        testIdPrefix="rail-ranking"
        label="Items to rank"
        items={options}
        addLabel="Item"
        disabled={disabled}
        onChange={(next) => onChange({ options: next })}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id="rail-ranking-min"
          label="Min select"
          value={minSelect ?? 0}
          disabled={disabled}
          onChange={(n) => onChange({ minSelect: n })}
        />
        <NumberField
          id="rail-ranking-max"
          label="Max select"
          value={maxSelect ?? options.length}
          disabled={disabled}
          onChange={(n) => onChange({ maxSelect: n })}
        />
      </div>
    </div>
  )
}

function MatrixEditor({
  rows,
  columns,
  disabled,
  onChange,
}: {
  rows: string[]
  columns: string[]
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <StringListEditor
        testIdPrefix="rail-matrix-rows"
        label="Rows"
        items={rows}
        addLabel="Row"
        disabled={disabled}
        onChange={(next) => onChange({ rows: next })}
      />
      <StringListEditor
        testIdPrefix="rail-matrix-cols"
        label="Columns"
        items={columns}
        addLabel="Column"
        disabled={disabled}
        onChange={(next) => onChange({ columns: next })}
      />
    </div>
  )
}

function LikertEditor({
  scale,
  disabled,
  onChange,
}: {
  scale: string[]
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <div className="border-t border-gray-100 pt-3">
      <StringListEditor
        testIdPrefix="rail-likert"
        label="Scale labels"
        items={scale}
        addLabel="Label"
        disabled={disabled}
        onChange={(next) => onChange({ scale: next })}
      />
    </div>
  )
}

function ImageChoiceEditor({
  imageOptions,
  multiSelect,
  disabled,
  onChange,
}: {
  imageOptions: Array<{ label: string; imageUrl: string }>
  multiSelect: boolean
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  function patchItem(idx: number, patch: Partial<{ label: string; imageUrl: string }>) {
    const next = [...imageOptions]
    next[idx] = { ...next[idx], ...patch }
    onChange({ imageOptions: next })
  }
  return (
    <section className="space-y-2 border-t border-gray-100 pt-3">
      <SectionHeader>Image options</SectionHeader>
      {imageOptions.length === 0 && (
        <p className="text-xs text-gray-500">No image options yet.</p>
      )}
      <ul className="space-y-2">
        {imageOptions.map((opt, i) => (
          <li key={i} className="space-y-1 rounded-md border border-gray-200 p-2">
            <TextField
              id={`rail-image-label-${i}`}
              label="Label"
              value={opt.label}
              disabled={disabled}
              onChange={(v) => patchItem(i, { label: v })}
            />
            <TextField
              id={`rail-image-url-${i}`}
              label="Image URL"
              value={opt.imageUrl}
              disabled={disabled}
              placeholder="https://…"
              onChange={(v) => patchItem(i, { imageUrl: v })}
            />
            <button
              type="button"
              aria-label={`Remove image ${i + 1}`}
              disabled={disabled}
              onClick={() => onChange({ imageOptions: imageOptions.filter((_, k) => k !== i) })}
              className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ imageOptions: [...imageOptions, { label: '', imageUrl: '' }] })}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add image option
      </button>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={multiSelect}
          disabled={disabled}
          onChange={(e) => onChange({ multiSelect: e.target.checked })}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">Allow multiple selections</span>
      </label>
    </section>
  )
}

function FileUploadEditor({
  maxSizeMB,
  allowedTypes,
  disabled,
  onChange,
}: {
  maxSizeMB: number
  allowedTypes: string[]
  disabled: boolean
  onChange: (patch: Partial<NonNullable<QuestionConfig>>) => void
}) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-3">
      <SectionHeader>File upload</SectionHeader>
      <NumberField
        id="rail-file-maxsize"
        label="Max size (MB)"
        value={maxSizeMB}
        disabled={disabled}
        onChange={(n) => onChange({ maxSizeMB: n })}
      />
      <StringListEditor
        testIdPrefix="rail-file-types"
        label="Allowed MIME types"
        items={allowedTypes}
        addLabel="MIME type"
        disabled={disabled}
        onChange={(next) => onChange({ allowedTypes: next })}
      />
      <p className="text-xs text-gray-500">
        Leave the list empty to allow all file types.
      </p>
    </section>
  )
}

// ─── Skip logic editor ────────────────────────────────────────────────────
//
// Per spec §"Question canvas" / RFC SkipRuleSchema (packages/shared/src/zod/
// survey.schema.ts:16-27). V0 supports a single `show` rule per question
// with N conditions joined by AND or OR — enough to express the common case
// ("only show this follow-up question if Q1 score < 7") without exposing
// rule-level action toggles in the right rail. The shared SkipRuleSchema
// still accepts hide rules and multi-rule arrays; the editor just doesn't
// surface them in V0.

const OPERATOR_LABELS: Array<{ value: SkipCondition['operator']; label: string; needsValue: boolean }> = [
  { value: 'eq', label: 'equals', needsValue: true },
  { value: 'ne', label: 'does not equal', needsValue: true },
  { value: 'gt', label: 'is greater than', needsValue: true },
  { value: 'gte', label: 'is at least', needsValue: true },
  { value: 'lt', label: 'is less than', needsValue: true },
  { value: 'lte', label: 'is at most', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'is_empty', label: 'is empty', needsValue: false },
  { value: 'is_not_empty', label: 'is answered', needsValue: false },
]

function SkipRuleEditor({
  question,
  otherQuestions,
  disabled,
  onChange,
}: {
  question: SurveyQuestion
  otherQuestions: SurveyQuestion[]
  disabled: boolean
  onChange: (rules: SkipRule[] | undefined) => void
}) {
  const rule = question.skipRules?.[0]
  const conditions = rule?.conditions ?? []

  function commitRule(next: { conditions: SkipCondition[]; logic: 'AND' | 'OR' }) {
    if (next.conditions.length === 0) {
      onChange(undefined)
      return
    }
    onChange([
      {
        targetQuestionId: question.id,
        action: 'show',
        conditions: next.conditions,
        conditionLogic: next.logic,
      },
    ])
  }

  function handleAddCondition() {
    if (disabled || otherQuestions.length === 0) return
    const next: SkipCondition = {
      sourceQuestionId: otherQuestions[0].id,
      operator: 'eq',
      value: '',
    }
    commitRule({
      conditions: [...conditions, next],
      logic: rule?.conditionLogic ?? 'AND',
    })
  }

  function handleConditionChange(idx: number, patch: Partial<SkipCondition>) {
    const next = conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    commitRule({ conditions: next, logic: rule?.conditionLogic ?? 'AND' })
  }

  function handleConditionRemove(idx: number) {
    const next = conditions.filter((_, i) => i !== idx)
    commitRule({ conditions: next, logic: rule?.conditionLogic ?? 'AND' })
  }

  function handleLogicChange(logic: 'AND' | 'OR') {
    commitRule({ conditions, logic })
  }

  if (otherQuestions.length === 0) {
    return (
      <section
        data-testid="skip-logic-section"
        className="border-t border-gray-100 pt-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Skip logic
        </h4>
        <p className="mt-1 text-xs text-gray-500">
          Add at least one other question to set up skip logic.
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="skip-logic-section"
      className="border-t border-gray-100 pt-3 space-y-2"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Skip logic
      </h4>
      {conditions.length === 0 ? (
        <p className="text-xs text-gray-500">
          This question is always shown. Add a condition to hide it unless
          a respondent answers another question a certain way.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Show this question when{' '}
          {conditions.length === 1
            ? 'this condition is met'
            : `${rule?.conditionLogic === 'OR' ? 'any' : 'all'} of these conditions are met`}:
        </p>
      )}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Match</span>
          <select
            value={rule?.conditionLogic ?? 'AND'}
            disabled={disabled}
            onChange={(e) => handleLogicChange(e.target.value as 'AND' | 'OR')}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs disabled:bg-gray-50"
          >
            <option value="AND">all (AND)</option>
            <option value="OR">any (OR)</option>
          </select>
        </div>
      )}
      <ul className="space-y-2">
        {conditions.map((c, i) => {
          const op = OPERATOR_LABELS.find((o) => o.value === c.operator)
          const needsValue = op?.needsValue ?? true
          return (
            <li
              key={i}
              data-testid={`skip-condition-${i}`}
              className="rounded-md border border-gray-200 bg-gray-50 p-2"
            >
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Source question"
                  value={c.sourceQuestionId}
                  disabled={disabled}
                  onChange={(e) => handleConditionChange(i, { sourceQuestionId: e.target.value })}
                  className="flex-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs disabled:bg-gray-50"
                >
                  {otherQuestions.map((q, qi) => (
                    <option key={q.id} value={q.id}>
                      Q{qi + 1}: {q.text.slice(0, 30)}{q.text.length > 30 ? '…' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Remove condition"
                  disabled={disabled}
                  onClick={() => handleConditionRemove(i)}
                  className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <select
                  aria-label="Operator"
                  value={c.operator}
                  disabled={disabled}
                  onChange={(e) =>
                    handleConditionChange(i, {
                      operator: e.target.value as SkipCondition['operator'],
                    })
                  }
                  className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs disabled:bg-gray-50"
                >
                  {OPERATOR_LABELS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {needsValue && (
                  <input
                    aria-label="Comparison value"
                    type="text"
                    value={
                      Array.isArray(c.value)
                        ? c.value.join(', ')
                        : c.value === undefined
                        ? ''
                        : String(c.value)
                    }
                    disabled={disabled}
                    onChange={(e) => handleConditionChange(i, { value: e.target.value })}
                    placeholder="e.g. 7"
                    className="flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        data-testid="skip-add-condition"
        disabled={disabled}
        onClick={handleAddCondition}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add condition
      </button>
    </section>
  )
}
