'use client'

import { useRef } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { renderConsentTextReact, hasPrivacyToken } from '@customerEQ/consent-text'
import type { OrgFormValues } from '../lib/types'

// Issue #292 Slice 4 — consent text editor.
//
// Toolbar buttons insert the verbose token form ({{kind:"Default Label"}})
// at the cursor; if a selection exists, the selection is wrapped as the
// inner label. Live preview uses renderConsentTextReact so the same parser
// + renderer that ship to the embedded survey form drives the admin
// preview (R18 single-source-of-truth).

const TOKEN_FORMS = {
  privacy: { token: 'privacy', defaultLabel: 'Privacy Policy' },
  terms: { token: 'terms', defaultLabel: 'Terms and Conditions' },
} as const

type Kind = keyof typeof TOKEN_FORMS

export function ConsentTextEditor() {
  const { control, watch, formState } = useFormContext<OrgFormValues>()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const consentMode = watch('consentMode')
  const consentTextValue = watch('consentTextDefault')
  const privacyPolicyUrl = watch('privacyPolicyUrl') || ''
  const termsUrl = watch('termsUrl') || ''
  const errors = formState.errors

  function insertToken(kind: Kind, currentValue: string, onChange: (next: string) => void) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = currentValue.slice(start, end)
    const label = selected !== '' ? selected : TOKEN_FORMS[kind].defaultLabel
    const insertion = `{{${TOKEN_FORMS[kind].token}:"${label}"}}`
    const next = currentValue.slice(0, start) + insertion + currentValue.slice(end)
    onChange(next)
    // After React re-renders the textarea, place the cursor / selection
    // around the inserted label so the admin can immediately re-type it.
    requestAnimationFrame(() => {
      const t = textareaRef.current
      if (!t) return
      if (selected !== '') {
        t.selectionStart = start + insertion.length
        t.selectionEnd = start + insertion.length
      } else {
        const labelStart = start + `{{${TOKEN_FORMS[kind].token}:"`.length
        t.selectionStart = labelStart
        t.selectionEnd = labelStart + label.length
      }
      t.focus()
    })
  }

  const previewNodes = renderConsentTextReact(consentTextValue, {
    privacyPolicyUrl: privacyPolicyUrl || undefined,
    termsUrl: termsUrl || undefined,
    className: 'text-indigo-600 underline',
    brokenClassName: 'text-gray-400 underline decoration-dashed cursor-not-allowed',
  })

  const privacyTokenWithoutUrl =
    hasPrivacyToken(consentTextValue) && privacyPolicyUrl.trim() === ''

  return (
    <div>
      <label htmlFor="consent-text" className="block text-sm font-medium text-gray-900">
        Consent text
      </label>
      <Controller
        control={control}
        name="consentTextDefault"
        render={({ field }) => (
          <div className="mt-1 overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => insertToken('privacy', field.value, field.onChange)}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + Privacy link
              </button>
              <button
                type="button"
                onClick={() => insertToken('terms', field.value, field.onChange)}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + Terms link
              </button>
            </div>
            <textarea
              id="consent-text"
              ref={(el) => {
                textareaRef.current = el
                field.ref(el)
              }}
              aria-label="Consent text"
              aria-invalid={errors.consentTextDefault ? 'true' : 'false'}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              rows={4}
              className="block w-full resize-y border-0 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-0"
              placeholder="By submitting this response, you agree we may use your feedback. See our {{privacy}} for details."
            />
          </div>
        )}
      />
      {errors.consentTextDefault && (
        <p className="mt-1 text-xs font-medium text-red-600">
          {errors.consentTextDefault.message}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Mustache tokens {`{{privacy}}`} and {`{{terms}}`} render as links. Custom labels:{' '}
        {`{{privacy:"data policy"}}`}.
      </p>

      {privacyTokenWithoutUrl && (
        <p
          className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800"
          data-testid="consent-privacy-broken-warning"
        >
          <span
            aria-hidden="true"
            className="mt-px inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
          >
            !
          </span>
          <span>
            Privacy policy URL is empty — your <code className="rounded bg-amber-100 px-1">{`{{privacy}}`}</code>{' '}
            link won't work until you set it below.
          </span>
        </p>
      )}

      <div
        data-testid="consent-preview"
        className="preview-card mt-3 overflow-hidden rounded-md border border-gray-200 bg-gray-50"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            👁 Preview
          </span>
          <span className="text-xs italic text-gray-400">
            {consentMode === 'EXPLICIT' ? 'Explicit (checkbox)' : 'Implied (paragraph)'}
          </span>
        </div>
        <div className="px-3.5 py-3">
          {consentTextValue.trim() === '' ? (
            <span className="text-sm italic text-gray-400">
              Add consent text to see how it will render.
            </span>
          ) : consentMode === 'EXPLICIT' ? (
            <label className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-900">
              <input type="checkbox" className="mt-0.5 accent-indigo-600" disabled />
              <span>{previewNodes}</span>
            </label>
          ) : (
            <p className="m-0 text-sm leading-relaxed text-gray-900">{previewNodes}</p>
          )}
        </div>
      </div>
    </div>
  )
}
