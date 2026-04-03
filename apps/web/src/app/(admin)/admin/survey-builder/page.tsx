'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkipCondition {
  sourceQuestionId: string
  operator: string
  value: string
}

interface SkipRule {
  targetQuestionId: string
  action: 'show' | 'hide'
  conditions: SkipCondition[]
  conditionLogic: 'AND' | 'OR'
}

interface Question {
  id: string
  text: string
  type: QuestionType
  required: boolean
  config: Record<string, unknown>
  skipRules: SkipRule[]
}

type QuestionType =
  | 'rating'
  | 'text'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'matrix'
  | 'ranking'
  | 'slider'
  | 'likert'
  | 'image_choice'
  | 'file_upload'

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

interface Program {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPES: { type: QuestionType; label: string; icon: string }[] = [
  { type: 'rating', label: 'Rating', icon: '⭐' },
  { type: 'text', label: 'Text', icon: '📝' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: '🔘' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑' },
  { type: 'dropdown', label: 'Dropdown', icon: '▾' },
  { type: 'matrix', label: 'Matrix', icon: '▦' },
  { type: 'ranking', label: 'Ranking', icon: '↕' },
  { type: 'slider', label: 'Slider', icon: '⟷' },
  { type: 'likert', label: 'Likert Scale', icon: '≡' },
  { type: 'image_choice', label: 'Image Choice', icon: '🖼' },
  { type: 'file_upload', label: 'File Upload', icon: '📎' },
]

const DEFAULT_CONFIGS: Record<QuestionType, Record<string, unknown>> = {
  rating: { min: 1, max: 5, leftLabel: '', rightLabel: '' },
  text: { placeholder: '', maxLength: 500, multiline: false },
  multiple_choice: { options: ['Option 1', 'Option 2'], allowOther: false },
  checkbox: { options: ['Option 1', 'Option 2'], allowOther: false },
  dropdown: { options: ['Option 1', 'Option 2'], allowOther: false },
  matrix: { rows: ['Row 1'], columns: ['Column 1'] },
  ranking: { options: ['Item 1', 'Item 2'] },
  slider: { min: 0, max: 100, step: 1, leftLabel: '', rightLabel: '' },
  likert: { scaleItems: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  image_choice: { items: [{ label: '', imageUrl: '' }], multiSelect: false },
  file_upload: { maxSizeMB: 10, allowedTypes: 'image/*,application/pdf' },
}

let nextId = 1
function genId() {
  return `q_${Date.now()}_${nextId++}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const btnPrimary =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
const btnSecondary =
  'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SurveyBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken } = useAuth()
  const surveyId = searchParams.get('surveyId')

  // Survey-level state
  const [name, setName] = useState('')
  const [surveyType, setSurveyType] = useState<SurveyType>('CUSTOM')
  const [programId, setProgramId] = useState('')
  const [incentivePoints, setIncentivePoints] = useState('')
  const [programs, setPrograms] = useState<Program[]>([])

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // UI state
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(!!surveyId)
  const [error, setError] = useState<string | null>(null)

  // ------- Fetch programs -------
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/programs`, { headers })
        if (res.ok) {
          const data = await res.json()
          setPrograms(data.data ?? data.programs ?? (Array.isArray(data) ? data : []))
        }
      } catch {
        /* ignore */
      }
    }
    load()
  }, [getToken])

  // ------- Fetch existing survey -------
  useEffect(() => {
    if (!surveyId) return
    async function load() {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/surveys/${surveyId}`, { headers })
        if (!res.ok) throw new Error('Failed to load survey')
        const data = await res.json()
        const survey = data.survey ?? data
        setName(survey.name ?? '')
        setSurveyType(survey.type ?? 'CUSTOM')
        setProgramId(survey.programId ?? '')
        setIncentivePoints(survey.incentivePoints != null ? String(survey.incentivePoints) : '')
        const qs: Question[] = (survey.questions ?? []).map((q: Record<string, unknown>) => ({
          id: (q.id as string) || genId(),
          text: (q.text as string) || '',
          type: (q.type as QuestionType) || 'text',
          required: !!q.required,
          config: (q.config as Record<string, unknown>) || {},
          skipRules: (q.skipRules as SkipRule[]) || [],
        }))
        setQuestions(qs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load survey')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [surveyId, getToken])

  // ------- Question operations -------
  const addQuestion = useCallback((type: QuestionType) => {
    const q: Question = {
      id: genId(),
      text: '',
      type,
      required: false,
      config: { ...DEFAULT_CONFIGS[type] },
      skipRules: [],
    }
    setQuestions((prev) => {
      const next = [...prev, q]
      setSelectedIdx(next.length - 1)
      return next
    })
  }, [])

  const updateQuestion = useCallback((idx: number, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }, [])

  const removeQuestion = useCallback(
    (idx: number) => {
      setQuestions((prev) => prev.filter((_, i) => i !== idx))
      if (selectedIdx === idx) setSelectedIdx(null)
      else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1)
    },
    [selectedIdx],
  )

  const moveQuestion = useCallback(
    (idx: number, dir: -1 | 1) => {
      setQuestions((prev) => {
        const next = [...prev]
        const target = idx + dir
        if (target < 0 || target >= next.length) return prev
        ;[next[idx], next[target]] = [next[target], next[idx]]
        if (selectedIdx === idx) setSelectedIdx(target)
        else if (selectedIdx === target) setSelectedIdx(idx)
        return next
      })
    },
    [selectedIdx],
  )

  // ------- Save / Publish -------
  const save = useCallback(
    async (publish: boolean) => {
      if (publish) setPublishing(true)
      else setSaving(true)
      setError(null)

      try {
        const token = await getToken()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`

        const payload: Record<string, unknown> = {
          name,
          type: surveyType,
          programId: programId || undefined,
          incentivePoints: incentivePoints ? Number(incentivePoints) : undefined,
          questions: questions.map((q) => ({
            id: q.id,
            text: q.text,
            type: q.type,
            required: q.required,
            config: q.config,
            skipRules: q.skipRules,
          })),
        }
        if (publish) payload.status = 'ACTIVE'

        const url = surveyId ? `${API_URL}/v1/surveys/${surveyId}` : `${API_URL}/v1/surveys`
        const method = surveyId ? 'PATCH' : 'POST'
        const res = await fetch(url, { method, headers, body: JSON.stringify(payload) })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.message ?? `Failed with status ${res.status}`)
        }
        const created = await res.json()
        const id = created.id ?? created.survey?.id ?? surveyId
        router.push(`/admin/surveys/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setSaving(false)
        setPublishing(false)
      }
    },
    [getToken, name, surveyType, programId, incentivePoints, questions, surveyId, router],
  )

  // ------- Selected question shortcut -------
  const selected = selectedIdx !== null ? questions[selectedIdx] : null

  // ------- Loading state -------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-gray-500">Loading survey...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* ============ Top Bar ============ */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Survey name"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px] flex-1 max-w-xs"
          />
          <select
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value as SurveyType)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="NPS">NPS</option>
            <option value="CSAT">CSAT</option>
            <option value="CES">CES</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
          >
            <option value="">No program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={incentivePoints}
            onChange={(e) => setIncentivePoints(e.target.value)}
            placeholder="Points"
            min={0}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
          />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => save(false)} disabled={saving || publishing} className={btnSecondary}>
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={() => save(true)} disabled={saving || publishing} className={btnPrimary}>
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ============ 3-Panel Layout ============ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left Panel: Palette ---- */}
        <div className="hidden md:block w-[240px] flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Question Types
          </p>
          <div className="space-y-1.5">
            {QUESTION_TYPES.map((qt) => (
              <button
                key={qt.type}
                onClick={() => addQuestion(qt.type)}
                className="flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
              >
                <span className="text-base leading-none">{qt.icon}</span>
                <span>{qt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Center Panel: Canvas ---- */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium mb-1">No questions yet</p>
              <p className="text-sm">Click a question type on the left to add one.</p>
            </div>
          )}
          <div className="space-y-2 max-w-2xl mx-auto">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => setSelectedIdx(idx)}
                className={`group flex items-start gap-2 rounded-lg border bg-white p-3 cursor-pointer transition-colors ${
                  selectedIdx === idx
                    ? 'border-indigo-400 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Drag handle placeholder */}
                <span className="text-gray-300 mt-0.5 select-none cursor-grab" title="Drag to reorder">
                  ⠿
                </span>

                {/* Question number */}
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    {q.text || <span className="italic text-gray-400">Untitled question</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {q.type.replace('_', ' ')}
                    </span>
                    {q.required && (
                      <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500">
                        Required
                      </span>
                    )}
                    {q.skipRules.length > 0 && (
                      <span className="inline-block rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-600">
                        Skip logic
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveQuestion(idx, -1)
                    }}
                    disabled={idx === 0}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveQuestion(idx, 1)
                    }}
                    disabled={idx === questions.length - 1}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeQuestion(idx)
                    }}
                    className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Right Panel: Config ---- */}
        <div className="hidden lg:block w-[340px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-4">
          {selected === null || selectedIdx === null ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a question to configure
            </div>
          ) : (
            <ConfigPanel
              question={selected}
              questions={questions}
              onChange={(patch) => updateQuestion(selectedIdx, patch)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Config Panel
// ---------------------------------------------------------------------------

function ConfigPanel({
  question,
  questions,
  onChange,
}: {
  question: Question
  questions: Question[]
  onChange: (patch: Partial<Question>) => void
}) {
  const config = question.config as Record<string, unknown>

  function updateConfig(patch: Record<string, unknown>) {
    onChange({ config: { ...config, ...patch } })
  }

  // helpers for list-type configs
  function getStringList(key: string): string[] {
    const v = config[key]
    return Array.isArray(v) ? v.map(String) : []
  }

  function setStringList(key: string, list: string[]) {
    updateConfig({ [key]: list })
  }

  function addToList(key: string, value: string) {
    setStringList(key, [...getStringList(key), value])
  }

  function removeFromList(key: string, idx: number) {
    setStringList(
      key,
      getStringList(key).filter((_, i) => i !== idx),
    )
  }

  function updateInList(key: string, idx: number, value: string) {
    const list = [...getStringList(key)]
    list[idx] = value
    setStringList(key, list)
  }

  // Skip rules helpers
  function addSkipRule() {
    const rule: SkipRule = {
      targetQuestionId: '',
      action: 'show',
      conditions: [{ sourceQuestionId: '', operator: 'equals', value: '' }],
      conditionLogic: 'AND',
    }
    onChange({ skipRules: [...question.skipRules, rule] })
  }

  function updateSkipRule(rIdx: number, patch: Partial<SkipRule>) {
    const rules = question.skipRules.map((r, i) => (i === rIdx ? { ...r, ...patch } : r))
    onChange({ skipRules: rules })
  }

  function removeSkipRule(rIdx: number) {
    onChange({ skipRules: question.skipRules.filter((_, i) => i !== rIdx) })
  }

  function updateCondition(rIdx: number, cIdx: number, patch: Partial<SkipCondition>) {
    const rules = [...question.skipRules]
    const conditions = rules[rIdx].conditions.map((c, i) => (i === cIdx ? { ...c, ...patch } : c))
    rules[rIdx] = { ...rules[rIdx], conditions }
    onChange({ skipRules: rules })
  }

  function addCondition(rIdx: number) {
    const rules = [...question.skipRules]
    rules[rIdx] = {
      ...rules[rIdx],
      conditions: [...rules[rIdx].conditions, { sourceQuestionId: '', operator: 'equals', value: '' }],
    }
    onChange({ skipRules: rules })
  }

  function removeCondition(rIdx: number, cIdx: number) {
    const rules = [...question.skipRules]
    rules[rIdx] = { ...rules[rIdx], conditions: rules[rIdx].conditions.filter((_, i) => i !== cIdx) }
    onChange({ skipRules: rules })
  }

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Question Config</p>

      {/* Question text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className={inputCls}
          placeholder="Enter question text..."
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={question.type}
          onChange={(e) => {
            const newType = e.target.value as QuestionType
            onChange({ type: newType, config: { ...DEFAULT_CONFIGS[newType] } })
          }}
          className={inputCls}
        >
          {QUESTION_TYPES.map((qt) => (
            <option key={qt.type} value={qt.type}>
              {qt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Required */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={question.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Required
      </label>

      {/* ---- Type-specific config ---- */}
      <div className="border-t border-gray-100 pt-4 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type Settings</p>

        {/* Rating */}
        {question.type === 'rating' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min</label>
                <input
                  type="number"
                  value={(config.min as number) ?? 1}
                  onChange={(e) => updateConfig({ min: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max</label>
                <input
                  type="number"
                  value={(config.max as number) ?? 5}
                  onChange={(e) => updateConfig({ max: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Left Label</label>
              <input
                type="text"
                value={(config.leftLabel as string) ?? ''}
                onChange={(e) => updateConfig({ leftLabel: e.target.value })}
                className={inputCls}
                placeholder="e.g. Not at all likely"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Right Label</label>
              <input
                type="text"
                value={(config.rightLabel as string) ?? ''}
                onChange={(e) => updateConfig({ rightLabel: e.target.value })}
                className={inputCls}
                placeholder="e.g. Extremely likely"
              />
            </div>
          </>
        )}

        {/* Text */}
        {question.type === 'text' && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
              <input
                type="text"
                value={(config.placeholder as string) ?? ''}
                onChange={(e) => updateConfig({ placeholder: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Length</label>
              <input
                type="number"
                value={(config.maxLength as number) ?? 500}
                onChange={(e) => updateConfig({ maxLength: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!config.multiline}
                onChange={(e) => updateConfig({ multiline: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Multiline
            </label>
          </>
        )}

        {/* Multiple choice / checkbox / dropdown */}
        {(question.type === 'multiple_choice' ||
          question.type === 'checkbox' ||
          question.type === 'dropdown') && (
          <>
            <OptionsList
              options={getStringList('options')}
              onUpdate={(idx, val) => updateInList('options', idx, val)}
              onRemove={(idx) => removeFromList('options', idx)}
              onAdd={() => addToList('options', `Option ${getStringList('options').length + 1}`)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!config.allowOther}
                onChange={(e) => updateConfig({ allowOther: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Allow &quot;Other&quot;
            </label>
          </>
        )}

        {/* Matrix */}
        {question.type === 'matrix' && (
          <>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Rows</p>
              <OptionsList
                options={getStringList('rows')}
                onUpdate={(idx, val) => updateInList('rows', idx, val)}
                onRemove={(idx) => removeFromList('rows', idx)}
                onAdd={() => addToList('rows', `Row ${getStringList('rows').length + 1}`)}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Columns</p>
              <OptionsList
                options={getStringList('columns')}
                onUpdate={(idx, val) => updateInList('columns', idx, val)}
                onRemove={(idx) => removeFromList('columns', idx)}
                onAdd={() => addToList('columns', `Column ${getStringList('columns').length + 1}`)}
              />
            </div>
          </>
        )}

        {/* Ranking */}
        {question.type === 'ranking' && (
          <OptionsList
            options={getStringList('options')}
            onUpdate={(idx, val) => updateInList('options', idx, val)}
            onRemove={(idx) => removeFromList('options', idx)}
            onAdd={() => addToList('options', `Item ${getStringList('options').length + 1}`)}
          />
        )}

        {/* Slider */}
        {question.type === 'slider' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min</label>
                <input
                  type="number"
                  value={(config.min as number) ?? 0}
                  onChange={(e) => updateConfig({ min: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max</label>
                <input
                  type="number"
                  value={(config.max as number) ?? 100}
                  onChange={(e) => updateConfig({ max: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Step</label>
                <input
                  type="number"
                  value={(config.step as number) ?? 1}
                  onChange={(e) => updateConfig({ step: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Left Label</label>
              <input
                type="text"
                value={(config.leftLabel as string) ?? ''}
                onChange={(e) => updateConfig({ leftLabel: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Right Label</label>
              <input
                type="text"
                value={(config.rightLabel as string) ?? ''}
                onChange={(e) => updateConfig({ rightLabel: e.target.value })}
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* Likert */}
        {question.type === 'likert' && (
          <OptionsList
            label="Scale Items"
            options={getStringList('scaleItems')}
            onUpdate={(idx, val) => updateInList('scaleItems', idx, val)}
            onRemove={(idx) => removeFromList('scaleItems', idx)}
            onAdd={() => addToList('scaleItems', `Item ${getStringList('scaleItems').length + 1}`)}
          />
        )}

        {/* Image Choice */}
        {question.type === 'image_choice' && (
          <>
            <ImageChoiceList
              items={(config.items as { label: string; imageUrl: string }[]) ?? []}
              onChange={(items) => updateConfig({ items })}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!config.multiSelect}
                onChange={(e) => updateConfig({ multiSelect: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Allow multiple selections
            </label>
          </>
        )}

        {/* File Upload */}
        {question.type === 'file_upload' && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Size (MB)</label>
              <input
                type="number"
                value={(config.maxSizeMB as number) ?? 10}
                onChange={(e) => updateConfig({ maxSizeMB: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Allowed Types</label>
              <input
                type="text"
                value={(config.allowedTypes as string) ?? ''}
                onChange={(e) => updateConfig({ allowedTypes: e.target.value })}
                className={inputCls}
                placeholder="e.g. image/*,application/pdf"
              />
            </div>
          </>
        )}
      </div>

      {/* ---- Skip Logic ---- */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Skip Logic</p>
          <button onClick={addSkipRule} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            + Add Rule
          </button>
        </div>

        {question.skipRules.map((rule, rIdx) => (
          <div key={rIdx} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Rule {rIdx + 1}</span>
              <button
                onClick={() => removeSkipRule(rIdx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Question</label>
                <select
                  value={rule.targetQuestionId}
                  onChange={(e) => updateSkipRule(rIdx, { targetQuestionId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select...</option>
                  {questions
                    .filter((q) => q.id !== question.id)
                    .map((q, qi) => (
                      <option key={q.id} value={q.id}>
                        Q{questions.indexOf(q) + 1}: {q.text || `Question ${qi + 1}`}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Action</label>
                <select
                  value={rule.action}
                  onChange={(e) => updateSkipRule(rIdx, { action: e.target.value as 'show' | 'hide' })}
                  className={inputCls}
                >
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Conditions</label>
                <div className="flex items-center gap-2">
                  <select
                    value={rule.conditionLogic}
                    onChange={(e) =>
                      updateSkipRule(rIdx, { conditionLogic: e.target.value as 'AND' | 'OR' })
                    }
                    className="rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                  <button
                    onClick={() => addCondition(rIdx)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {rule.conditions.map((cond, cIdx) => (
                <div key={cIdx} className="flex items-center gap-1.5 mb-1.5">
                  <select
                    value={cond.sourceQuestionId}
                    onChange={(e) => updateCondition(rIdx, cIdx, { sourceQuestionId: e.target.value })}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Source Q...</option>
                    {questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        Q{questions.indexOf(q) + 1}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(rIdx, cIdx, { operator: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="greater_than">greater than</option>
                    <option value="less_than">less than</option>
                    <option value="contains">contains</option>
                    <option value="is_empty">is empty</option>
                  </select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(rIdx, cIdx, { value: e.target.value })}
                    placeholder="Value"
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => removeCondition(rIdx, cIdx)}
                    className="text-gray-400 hover:text-red-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Library Buttons ---- */}
      <div className="border-t border-gray-100 pt-4 flex gap-2">
        <button className={btnSecondary + ' flex-1 text-xs'} title="Save to Library (coming soon)" disabled>
          Save to Library
        </button>
        <button
          className={btnSecondary + ' flex-1 text-xs'}
          title="Insert from Library (coming soon)"
          disabled
        >
          Insert from Library
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OptionsList sub-component
// ---------------------------------------------------------------------------

function OptionsList({
  label,
  options,
  onUpdate,
  onRemove,
  onAdd,
}: {
  label?: string
  options: string[]
  onUpdate: (idx: number, value: string) => void
  onRemove: (idx: number) => void
  onAdd: () => void
}) {
  return (
    <div>
      {label && <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>}
      <div className="space-y-1.5">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              type="text"
              value={opt}
              onChange={(e) => onUpdate(idx, e.target.value)}
              className={inputCls + ' flex-1'}
            />
            <button
              onClick={() => onRemove(idx)}
              className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
        + Add option
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImageChoiceList sub-component
// ---------------------------------------------------------------------------

function ImageChoiceList({
  items,
  onChange,
}: {
  items: { label: string; imageUrl: string }[]
  onChange: (items: { label: string; imageUrl: string }[]) => void
}) {
  function update(idx: number, patch: Partial<{ label: string; imageUrl: string }>) {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    onChange(next)
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function add() {
    onChange([...items, { label: '', imageUrl: '' }])
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">Image Choices</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-1.5">
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={item.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Label"
                className={inputCls}
              />
              <input
                type="text"
                value={item.imageUrl}
                onChange={(e) => update(idx, { imageUrl: e.target.value })}
                placeholder="Image URL"
                className={inputCls}
              />
            </div>
            <button
              onClick={() => remove(idx)}
              className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs mt-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
        + Add image choice
      </button>
    </div>
  )
}
