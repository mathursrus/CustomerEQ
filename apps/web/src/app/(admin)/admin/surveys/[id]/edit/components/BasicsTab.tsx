// Issue #241 Slice 4b (#336) — BasicsTab.
//
// Per Spec §2.1 / R6 / R7 / R8 / R30:
//   - Required fields: Internal name (Survey.name), Survey title (Survey.title).
//   - Type card-grid (NPS · CSAT · CES · Custom) with R6 confirmation modal
//     when switching presets while questions exist. Custom is "keep" — no modal.
//   - Program selector: one program → display the name; many → require explicit
//     <select> choice (project_241_slice4_program_selection.md).
//   - Embeds <ConsentCollectionSubBlock> as the consent surface.

'use client'

import { useState } from 'react'

import { ModalShell } from '@/components/ModalShell'

import { ConsentCollectionSubBlock } from './ConsentCollectionSubBlock'
import { isFieldEditable } from '../../../_helpers/field-editability'
import { freshPresetFor, isUnchangedPreset } from '../../../_helpers/presets'
import type {
  EditorBrand,
  EditorSurvey,
  ProgramWithEarningRule,
} from '../__fixtures__/editor-fixtures'

type SurveyType = 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
type ConsentMode = 'INHERIT' | 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
type ResponsePolicy = 'ONCE' | 'MULTIPLE' | 'LATEST_OVERWRITES'

export interface BasicsTabProps {
  survey: EditorSurvey
  brand: EditorBrand
  programs: ProgramWithEarningRule[]
  /** Controlled consent mode (optional — falls back to local state if absent). */
  consentMode?: ConsentMode
  /** Controlled consent text override (optional — falls back to local state). */
  consentTextOverride?: string | null
  /**
   * Optional dedicated callback for consent changes. When provided, replaces
   * the implicit onFieldChange('consentMode'/'consentTextOverride') calls so
   * the parent (SurveyEditorForm) can gate more-permissive overrides behind
   * the attestation modal per R10.
   */
  onConsentChange?: (next: { consentMode: ConsentMode; consentTextOverride: string | null }) => void
  onFieldChange: (field: string, value: unknown) => void
  onTypeChange: (next: SurveyType) => void
  disabled: boolean
}

// Verbiage + icons from docs/feature-specs/mocks/241-survey-admin-ux.html
// lines 578-602. These were deliberately iterated — do not paraphrase.
const TYPE_CARDS: Array<{
  value: SurveyType
  icon: string
  title: string
  sub: string | null
  when: string
  meta: string
}> = [
  {
    value: 'NPS',
    icon: '⭐',
    title: 'NPS',
    sub: 'Net Promoter',
    when: 'Loyalty health — would you recommend us?',
    meta: '1 standard question + 1 follow-up',
  },
  {
    value: 'CSAT',
    icon: '❤',
    title: 'CSAT',
    sub: 'Satisfaction',
    when: 'Moment quality — how did this experience go?',
    meta: '1 standard question + 1 follow-up',
  },
  {
    value: 'CES',
    icon: '⚡',
    title: 'CES',
    sub: 'Effort',
    when: 'Friction — how easy was it?',
    meta: '1 standard question + 1 follow-up',
  },
  {
    value: 'CUSTOM',
    icon: '✎',
    title: 'Custom',
    sub: null,
    when: 'Build your own — any mix of question types.',
    meta: 'Blank canvas',
  },
]

const RESPONSE_POLICY_OPTIONS: Array<{ value: ResponsePolicy; label: string }> = [
  { value: 'ONCE', label: 'One response per member' },
  { value: 'MULTIPLE', label: 'Multiple responses allowed' },
  { value: 'LATEST_OVERWRITES', label: 'Latest response replaces previous' },
]

function effectiveConsentMode(survey: EditorSurvey, brand: EditorBrand): ConsentMode {
  // The editor stores the consent mode in survey.consentMode (Slice 2 added the
  // column). Until the operator selects an override, treat null/undefined as
  // "INHERIT" so the dropdown reflects today's runtime state cleanly.
  const stored = (survey as { consentMode?: ConsentMode | null }).consentMode
  if (stored === 'EXPLICIT' || stored === 'IMPLIED_ON_SUBMIT') return stored
  // brand modes are EXPLICIT / IMPLIED_ON_SUBMIT — handled by the sub-block
  // for badge display; here we just signal "no override" to the dropdown.
  void brand
  return 'INHERIT'
}

export function BasicsTab({
  survey,
  brand,
  programs,
  consentMode: consentModeProp,
  consentTextOverride: consentTextOverrideProp,
  onConsentChange,
  onFieldChange,
  onTypeChange,
  disabled,
}: BasicsTabProps) {
  const [name, setName] = useState<string>(survey.name ?? '')
  const [title, setTitle] = useState<string>(survey.title ?? '')
  const [description, setDescription] = useState<string>(survey.description ?? '')
  const [responsePolicy, setResponsePolicy] = useState<ResponsePolicy>(
    survey.responsePolicy ?? 'MULTIPLE',
  )
  const [programId, setProgramId] = useState<string>(survey.programId)
  const [nameError, setNameError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const [pendingType, setPendingType] = useState<SurveyType | null>(null)
  const [quickGuideOpen, setQuickGuideOpen] = useState<boolean>(false)
  const [localConsentMode, setLocalConsentMode] = useState<ConsentMode>(
    effectiveConsentMode(survey, brand),
  )
  const [localConsentText, setLocalConsentText] = useState<string | null>(
    survey.consentTextOverride,
  )
  const consentMode = consentModeProp ?? localConsentMode
  const consentTextOverride = consentTextOverrideProp ?? localConsentText

  // R29 / R30: per-field editability driven by survey.status (and
  // responsesCount for responsePolicy). Mirrors the server allowlist.
  const responsesCount =
    (survey as { responsesCount?: number; _count?: { responses: number } }).responsesCount ??
    (survey as { _count?: { responses: number } })._count?.responses ??
    0
  const editCtx = { responsesCount }
  const typeEditable = isFieldEditable('type', survey.status, editCtx)
  const programEditable = isFieldEditable('programId', survey.status, editCtx)
  const responsePolicyEditable = isFieldEditable('responsePolicy', survey.status, editCtx)

  function applyTypeSwap(next: SurveyType) {
    // Atomic-from-the-user's-POV swap: change type + replace questions with
    // the preset for the new type. Two PATCHes fire (one per field) but the
    // editor state reflects both immediately via the parent's values merge.
    onTypeChange(next)
    onFieldChange('questions', freshPresetFor(next))
  }

  function handleTypeClick(next: SurveyType) {
    if (next === survey.type) return
    const currentQuestions = survey.questions ?? []
    // Safe swap paths (no operator edits at risk):
    //   - Empty questions array.
    //   - Questions match the current type's preset exactly (untouched).
    // In both cases, swap silently. Otherwise, surface the modal — switching
    // would discard custom edits the operator made to the question set.
    if (currentQuestions.length === 0 || isUnchangedPreset(currentQuestions, survey.type)) {
      applyTypeSwap(next)
      return
    }
    setPendingType(next)
  }

  function handleProgramChange(next: string) {
    setProgramId(next)
    onFieldChange('programId', next)
  }

  function handleConsentChange(next: {
    consentMode: ConsentMode
    consentTextOverride: string | null
  }) {
    setLocalConsentMode(next.consentMode)
    setLocalConsentText(next.consentTextOverride)
    if (onConsentChange) {
      onConsentChange(next)
      return
    }
    onFieldChange('consentMode', next.consentMode)
    onFieldChange('consentTextOverride', next.consentTextOverride)
  }

  const onlyProgram = programs.length === 1 ? programs[0] : null
  // Resolve the selected program name for the multi-program select default.
  const selectedProgramName =
    programs.find((p) => p.id === programId)?.name ?? programs[0]?.name ?? ''
  void selectedProgramName

  return (
    <div className="space-y-5 p-4">
      {/* Internal name + Survey title — 2-column row per mock §241 lines 561-572. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="basics-name" className="block text-sm font-medium text-gray-900">
            Internal name <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Used in the surveys list and analytics. Only your team sees this.
          </p>
          <input
            id="basics-name"
            type="text"
            aria-label="Internal name"
            aria-required="true"
            aria-invalid={nameError ? 'true' : 'false'}
            value={name}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              setName(v)
              setNameError(null)
              onFieldChange('name', v)
            }}
            onBlur={() => {
              if (!name.trim()) setNameError('Internal name is required.')
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
              nameError ? 'border-red-400' : 'border-gray-300 focus:border-indigo-500'
            } disabled:bg-gray-50 disabled:text-gray-500`}
            placeholder="e.g. NPS Q3 launch"
          />
          {nameError && (
            <p className="mt-1 text-xs text-red-600">{nameError}</p>
          )}
        </div>

        <div>
          <label htmlFor="basics-title" className="block text-sm font-medium text-gray-900">
            Survey title <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Shown to respondents at the top of the form.
          </p>
          <input
            id="basics-title"
            type="text"
            aria-label="Survey title"
            aria-required="true"
            aria-invalid={titleError ? 'true' : 'false'}
            value={title}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              setTitle(v)
              setTitleError(null)
              onFieldChange('title', v)
            }}
            onBlur={() => {
              if (!title.trim()) setTitleError('Survey title is required.')
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
              titleError ? 'border-red-400' : 'border-gray-300 focus:border-indigo-500'
            } disabled:bg-gray-50 disabled:text-gray-500`}
            placeholder="What respondents see at the top of the survey."
          />
          {titleError && (
            <p className="mt-1 text-xs text-red-600">{titleError}</p>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <span>Survey type <span className="text-red-500">*</span></span>
          {/* Disabled-field affordance per C1 — visible amber lock icon plus
              native title so the reason is reachable by hover and click. */}
          {!typeEditable && (
            <span
              data-testid="type-locked-icon"
              title="Survey type is locked once the survey leaves Draft. Discard the survey and start a new draft if you need a different type."
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
            >
              <span aria-hidden="true">🔒</span> Locked
            </span>
          )}
        </label>
        {/* Field helper per mock line 576. */}
        <p className="mt-1 text-xs text-gray-500">
          Picking NPS / CSAT / CES auto-populates the Questions tab with the
          standard set (all editable). Custom = blank canvas.
        </p>
        {!typeEditable && (
          <p
            data-testid="type-locked-hint"
            className="mt-1 text-xs text-amber-700"
          >
            Survey type can only be changed while the survey is a Draft.
          </p>
        )}
        <div role="radiogroup" aria-label="Survey type" className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          {TYPE_CARDS.map((c) => {
            const checked = survey.type === c.value
            const cardDisabled = disabled || !typeEditable
            return (
              <label
                key={c.value}
                data-testid={`type-card-${c.value}`}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  checked
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${cardDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  role="radio"
                  aria-label={c.title}
                  aria-checked={checked}
                  value={c.value}
                  name="survey-type"
                  checked={checked}
                  disabled={cardDisabled}
                  onChange={() => handleTypeClick(c.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-base ${
                    checked ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {c.icon}
                </span>
                <span className="mt-1 flex items-baseline gap-1.5 text-sm font-semibold text-gray-900">
                  {c.title}
                  {c.sub && (
                    <span className="text-[11px] font-medium text-gray-500">{c.sub}</span>
                  )}
                </span>
                <span className="text-xs leading-snug text-gray-500">{c.when}</span>
                <span
                  className={`mt-0.5 text-[11px] ${
                    checked ? 'text-indigo-600' : 'text-gray-400'
                  }`}
                >
                  {c.meta}
                </span>
              </label>
            )
          })}
        </div>
        {/* "Not sure which to pick?" collapsible quick guide — mock lines 603-612. */}
        <button
          type="button"
          data-testid="type-help-toggle"
          aria-expanded={quickGuideOpen}
          onClick={() => setQuickGuideOpen((v) => !v)}
          className="mt-2.5 inline-flex items-center gap-2 text-xs text-gray-500 underline hover:text-gray-700"
        >
          <span aria-hidden="true">{quickGuideOpen ? '▼' : '▶'}</span>
          Not sure which to pick?
        </button>
        {quickGuideOpen && (
          <div
            data-testid="type-quick-guide"
            className="mt-2 rounded-md bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-600"
          >
            <p className="font-medium text-gray-700">
              Quick guide — pick the score that matches the moment you&apos;re capturing:
            </p>
            <ul className="mt-1.5 list-disc pl-5">
              <li>
                <strong className="text-gray-900">NPS</strong> works after a
                relationship checkpoint — a tier upgrade, a 1-year anniversary,
                an annual program review.
              </li>
              <li>
                <strong className="text-gray-900">CSAT</strong> works right after
                an experience — a purchase, a redemption, a delivered service.
              </li>
              <li>
                <strong className="text-gray-900">CES</strong> works after the
                customer had to do something — sign up, enroll, contact support.
              </li>
              <li>
                <strong className="text-gray-900">Custom</strong> when none of
                the above fits — you build the questions from scratch with all
                11 question types.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Program + Description — 2-column row per mock §241 lines 615-629. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <span>Program <span className="text-red-500">*</span></span>
            {!programEditable && (
              <span
                title="Program is locked once the survey leaves Draft. Earning rules belong to the program; changing program mid-cycle would re-target where points credit."
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
              >
                <span aria-hidden="true">🔒</span> Locked
              </span>
            )}
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Points credit through this program. Members must be enrolled.
          </p>
          {onlyProgram ? (
            <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {onlyProgram.name}
              <span className="ml-2 text-xs text-gray-500">
                (only program in this brand)
              </span>
            </p>
          ) : (
            <select
              aria-label="Program"
              value={programId}
              disabled={disabled || !programEditable}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {!programEditable && (
            <p className="mt-1 text-xs text-gray-500">
              Program can only be changed while the survey is a Draft.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="basics-description" className="block text-sm font-medium text-gray-900">
            Description
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Short admin note — surfaces in the surveys list under the name.
          </p>
          <input
            id="basics-description"
            type="text"
            aria-label="Description"
            value={description}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              setDescription(v)
              onFieldChange('description', v)
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="Internal notes about this survey."
          />
        </div>
      </div>

      <div>
        <label htmlFor="basics-response-policy" className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <span>Response policy</span>
          {!responsePolicyEditable && (
            <span
              title="Response policy locks once the survey collects responses or leaves Draft — changing it mid-flight would invalidate existing rows."
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
            >
              <span aria-hidden="true">🔒</span> Locked
            </span>
          )}
        </label>
        <select
          id="basics-response-policy"
          aria-label="Response policy"
          value={responsePolicy}
          disabled={disabled || !responsePolicyEditable}
          onChange={(e) => {
            const v = e.target.value as ResponsePolicy
            setResponsePolicy(v)
            onFieldChange('responsePolicy', v)
          }}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
        >
          {RESPONSE_POLICY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!responsePolicyEditable && (
          <p className="mt-1 text-xs text-gray-500">
            Response policy locks once the survey has responses or leaves Draft.
          </p>
        )}
      </div>

      <ConsentCollectionSubBlock
        brand={brand}
        consentMode={consentMode}
        consentTextOverride={consentTextOverride}
        onChange={handleConsentChange}
        disabled={disabled}
      />

      <ModalShell open={pendingType !== null} ariaLabel="Change survey type">
        <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Change survey type</h3>
            <p className="mt-2 text-sm text-gray-600">
              Switching to <span className="font-medium text-gray-900">{pendingType}</span>{' '}
              will replace your current questions with the {pendingType} preset. Custom
              edits to the current questions will be lost.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingType(null)}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = pendingType
                  setPendingType(null)
                  if (next) applyTypeSwap(next)
                }}
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Change type
              </button>
            </div>
          </div>
      </ModalShell>
    </div>
  )
}
