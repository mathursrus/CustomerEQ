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

const TYPE_CARDS: Array<{ value: SurveyType; title: string; helper: string }> = [
  { value: 'NPS', title: 'NPS', helper: 'Net Promoter Score — 0 to 10.' },
  { value: 'CSAT', title: 'CSAT', helper: 'Customer Satisfaction — 1 to 5.' },
  { value: 'CES', title: 'CES', helper: 'Customer Effort Score — 1 to 7.' },
  { value: 'CUSTOM', title: 'Custom', helper: 'Build your own question set.' },
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
  const [localConsentMode, setLocalConsentMode] = useState<ConsentMode>(
    effectiveConsentMode(survey, brand),
  )
  const [localConsentText, setLocalConsentText] = useState<string | null>(
    survey.consentTextOverride,
  )
  const consentMode = consentModeProp ?? localConsentMode
  const consentTextOverride = consentTextOverrideProp ?? localConsentText

  const hasQuestions = (survey.questions?.length ?? 0) > 0

  function handleTypeClick(next: SurveyType) {
    if (next === survey.type) return
    if (next === 'CUSTOM') {
      onTypeChange('CUSTOM')
      return
    }
    if (hasQuestions) {
      setPendingType(next)
      return
    }
    onTypeChange(next)
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
      <div>
        <label htmlFor="basics-name" className="block text-sm font-medium text-gray-900">
          Internal name <span className="text-red-500">*</span>
        </label>
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
        <p className="mt-1 text-xs text-gray-500">
          Not shown to respondents. Used in lists, search, and analytics.
        </p>
      </div>

      <div>
        <label htmlFor="basics-title" className="block text-sm font-medium text-gray-900">
          Survey title <span className="text-red-500">*</span>
        </label>
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

      <div>
        <span className="block text-sm font-medium text-gray-900">Type</span>
        <div role="radiogroup" aria-label="Survey type" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
          {TYPE_CARDS.map((c) => {
            const checked = survey.type === c.value
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  checked
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  role="radio"
                  aria-label={c.title}
                  aria-checked={checked}
                  value={c.value}
                  name="survey-type"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => handleTypeClick(c.value)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                <span className="text-xs text-gray-500">{c.helper}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-900">Program</span>
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
            disabled={disabled}
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
      </div>

      <div>
        <label htmlFor="basics-description" className="block text-sm font-medium text-gray-900">
          Description
        </label>
        <textarea
          id="basics-description"
          aria-label="Description"
          rows={2}
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

      <div>
        <label htmlFor="basics-response-policy" className="block text-sm font-medium text-gray-900">
          Response policy
        </label>
        <select
          id="basics-response-policy"
          aria-label="Response policy"
          value={responsePolicy}
          disabled={disabled}
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
                  if (next) onTypeChange(next)
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
