'use client'

import { useFormContext } from 'react-hook-form'
import { ConsentTextEditor } from '../ConsentTextEditor'
import type { OrgFormValues, ConsentMode } from '../../lib/types'

// Issue #292 Slice 4 — Consent & legal section. Spec §F7 / §F8 / §F9 / §F10.
//
// consentMode flips are intercepted by OrganizationSettingsForm so the
// IMPLIED attestation modal can fire BEFORE the value lands in form state.

const MODES: { value: ConsentMode; title: string; desc: string }[] = [
  {
    value: 'EXPLICIT',
    title: 'Explicit',
    desc: 'Members must check a consent box on every survey response. Privacy URL required.',
  },
  {
    value: 'IMPLIED_ON_SUBMIT',
    title: 'Implied',
    desc: 'Consent is captured implicitly when a member submits a survey. Requires attestation.',
  },
]

interface ConsentLegalSectionProps {
  onConsentModeFlipAttempt: (next: ConsentMode) => void
}

export function ConsentLegalSection({ onConsentModeFlipAttempt }: ConsentLegalSectionProps) {
  const { register, watch, formState } = useFormContext<OrgFormValues>()
  const value = watch('consentMode')
  const errors = formState.errors

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-gray-900">Consent mode</span>
        <div role="radiogroup" aria-label="Consent mode" className="mt-2 flex flex-col gap-2">
          {MODES.map((opt) => {
            const selected = value === opt.value
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border bg-white px-3.5 py-3 ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  aria-label={opt.title}
                  checked={selected}
                  onChange={() => onConsentModeFlipAttempt(opt.value)}
                  className="mt-0.5 shrink-0 accent-indigo-600"
                />
                <span className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{opt.desc}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <ConsentTextEditor />

      <div>
        <label htmlFor="privacy-url" className="block text-sm font-medium text-gray-900">
          Privacy policy URL{' '}
          {value === 'EXPLICIT' && <span className="text-red-600">*</span>}
        </label>
        <input
          id="privacy-url"
          type="url"
          aria-label="Privacy policy URL"
          aria-invalid={errors.privacyPolicyUrl ? 'true' : 'false'}
          placeholder="https://acmecoffee.com/privacy"
          {...register('privacyPolicyUrl')}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.privacyPolicyUrl ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.privacyPolicyUrl && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {errors.privacyPolicyUrl.message}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Required for Explicit consent mode. Resolves the {`{{privacy}}`} link in your consent
          text.
        </p>
      </div>

      <div>
        <label htmlFor="terms-url" className="block text-sm font-medium text-gray-900">
          Terms and Conditions URL
        </label>
        <input
          id="terms-url"
          type="url"
          aria-label="Terms and Conditions URL"
          aria-invalid={errors.termsUrl ? 'true' : 'false'}
          placeholder="https://acmecoffee.com/terms"
          {...register('termsUrl')}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.termsUrl ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.termsUrl && (
          <p className="mt-1 text-xs font-medium text-red-600">{errors.termsUrl.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Optional — resolves the {`{{terms}}`} link in your consent text.
        </p>
      </div>
    </div>
  )
}
