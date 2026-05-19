// Issue #241 Slice 4b (#336) — ConsentCollectionSubBlock.
//
// Per Spec §2.1.1 / R9–R14:
//   - Dropdown shows "Inherit (<brand-mode>)" + one Override option (the
//     opposite of the brand's default). Operator chooses one or the other —
//     no four-option matrix.
//   - Privacy / Terms toolbar buttons insert the canonical token shape
//     ({{kind:"Default Label"}}) at the cursor; Terms button hides when
//     Brand.termsUrl === null (R12 edge).
//   - Preview reflects the effective mode (checkbox iff EXPLICIT) and the
//     effective text (override if set, otherwise brand default).
//   - R13: consentTextOverride === '' is a deliberate suppress — preview
//     body renders empty (no inherited brand text fallback).
//   - R14 mode badge labels the effective mode.

'use client'

import { useRef } from 'react'

import { renderConsentTextReact } from '@customerEQ/consent-text'

import type { EditorBrand } from '../__fixtures__/editor-fixtures'

type ConsentMode = 'INHERIT' | 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'
type EffectiveMode = 'EXPLICIT' | 'IMPLIED_ON_SUBMIT'

export interface ConsentCollectionSubBlockProps {
  brand: EditorBrand
  consentMode: ConsentMode
  consentTextOverride: string | null
  onChange: (next: {
    consentMode: ConsentMode
    consentTextOverride: string | null
  }) => void
  disabled: boolean
}

const MODE_LABEL: Record<EffectiveMode, string> = {
  EXPLICIT: 'Explicit',
  IMPLIED_ON_SUBMIT: 'Implied on submit',
}

const TOKEN_FORMS = {
  privacy: { token: 'privacy', defaultLabel: 'Privacy Policy' },
  terms: { token: 'terms', defaultLabel: 'Terms and Conditions' },
} as const

function resolveEffectiveMode(brandMode: EffectiveMode, override: ConsentMode): EffectiveMode {
  return override === 'INHERIT' ? brandMode : override
}

function isMorePermissive(brandMode: EffectiveMode, effective: EffectiveMode): boolean {
  // Only EXPLICIT → IMPLIED_ON_SUBMIT is "more permissive" (drops the opt-in).
  return brandMode === 'EXPLICIT' && effective === 'IMPLIED_ON_SUBMIT'
}

export function ConsentCollectionSubBlock({
  brand,
  consentMode,
  consentTextOverride,
  onChange,
  disabled,
}: ConsentCollectionSubBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const effectiveMode = resolveEffectiveMode(brand.consentMode, consentMode)
  const showDeviationCallout = isMorePermissive(brand.consentMode, effectiveMode)
  const oppositeMode: EffectiveMode =
    brand.consentMode === 'EXPLICIT' ? 'IMPLIED_ON_SUBMIT' : 'EXPLICIT'
  const oppositeLabel =
    oppositeMode === 'EXPLICIT' ? 'Explicit consent required' : 'Implied on submit'

  // Effective text the preview should render. consentTextOverride === null
  // means "inherit"; consentTextOverride === '' is R13 suppress (preview empty).
  const effectiveText: string =
    consentTextOverride === null ? brand.consentTextDefault ?? '' : consentTextOverride
  const hasVisibleText = effectiveText.trim().length > 0

  function handleModeChange(next: ConsentMode) {
    onChange({ consentMode: next, consentTextOverride })
  }

  function handleTextChange(next: string) {
    onChange({ consentMode, consentTextOverride: next })
  }

  function insertToken(kind: keyof typeof TOKEN_FORMS) {
    const ta = textareaRef.current
    const current = consentTextOverride ?? ''
    const start = ta?.selectionStart ?? current.length
    const end = ta?.selectionEnd ?? current.length
    const selected = current.slice(start, end)
    const label = selected !== '' ? selected : TOKEN_FORMS[kind].defaultLabel
    const insertion = `{{${TOKEN_FORMS[kind].token}:"${label}"}}`
    const next = current.slice(0, start) + insertion + current.slice(end)
    handleTextChange(next)
    requestAnimationFrame(() => {
      const t = textareaRef.current
      if (!t) return
      const cursor = start + insertion.length
      t.selectionStart = cursor
      t.selectionEnd = cursor
      t.focus()
    })
  }

  const previewNodes = hasVisibleText
    ? renderConsentTextReact(effectiveText, {
        privacyPolicyUrl: brand.privacyPolicyUrl ?? undefined,
        termsUrl: brand.termsUrl ?? undefined,
        className: 'text-indigo-600 underline',
        brokenClassName: 'text-gray-400 underline decoration-dashed',
      })
    : null

  return (
    <div
      data-testid="consent-collection-subblock"
      className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="consent-mode-select" className="text-sm font-medium text-gray-900">
          Consent mode
        </label>
        <select
          id="consent-mode-select"
          aria-label="Consent mode"
          value={consentMode}
          disabled={disabled}
          onChange={(e) => handleModeChange(e.target.value as ConsentMode)}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100"
        >
          <option value="INHERIT">{`Inherit (${MODE_LABEL[brand.consentMode]})`}</option>
          <option value={oppositeMode}>{`Override · ${oppositeLabel}`}</option>
        </select>
        <span
          data-testid="consent-mode-badge"
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            consentMode === 'INHERIT'
              ? 'bg-gray-200 text-gray-700'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {MODE_LABEL[effectiveMode]}
        </span>
      </div>

      {showDeviationCallout && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This deviation will be logged — when you save, you&apos;ll be asked to confirm
          and supply a reason.
        </p>
      )}

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900">Disclosure text</span>
          <div className="consent-toolbar ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Insert privacy link"
              onClick={() => insertToken('privacy')}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Privacy link
            </button>
            {brand.termsUrl !== null && (
              <button
                type="button"
                aria-label="Insert terms link"
                onClick={() => insertToken('terms')}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                + Terms link
              </button>
            )}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          aria-label="Consent disclosure text"
          rows={3}
          value={consentTextOverride ?? ''}
          disabled={disabled}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={brand.consentTextDefault ?? 'Enter disclosure text or leave blank to suppress.'}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave blank to suppress consent collection entirely for this survey.
        </p>
      </div>

      <div
        data-testid="consent-preview"
        className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-900"
      >
        {hasVisibleText ? (
          effectiveMode === 'EXPLICIT' ? (
            <label className="flex items-start gap-2 leading-relaxed">
              <input type="checkbox" disabled className="mt-0.5 accent-indigo-600" />
              <span>{previewNodes}</span>
            </label>
          ) : (
            <p className="m-0 leading-relaxed">{previewNodes}</p>
          )
        ) : null}
      </div>
    </div>
  )
}
