'use client'

import { useFormContext } from 'react-hook-form'
import { useOrganization } from '@clerk/nextjs'
import type { OrgFormValues, OrgSizeCategory } from '../../lib/types'

// Issue #292 Slice 4 — Identity section.
//
// Renders TWO distinct name surfaces (Q2 reframe — RFC §7a):
//   • Organization Name — read-only, sourced from Clerk session
//     (useOrganization). The Brand row's name is intentionally decoupled.
//   • Brand Name — editable, maps to Brand.name. PATCH writes Brand only;
//     no IdentityProvider.updateOrgName call (verified by API integration
//     test in Slice 3).

const ORG_SIZES: { value: OrgSizeCategory; label: string }[] = [
  { value: 'SIZE_1_10', label: '1–10' },
  { value: 'SIZE_11_50', label: '11–50' },
  { value: 'SIZE_51_300', label: '51–300' },
  { value: 'SIZE_301_5000', label: '301–5000' },
  { value: 'SIZE_5000_PLUS', label: '5000+' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

export function IdentitySection() {
  const { register, watch, setValue, formState } = useFormContext<OrgFormValues>()
  const { organization } = useOrganization()
  const orgSize = watch('orgSize')
  const errors = formState.errors

  // Clerk's useOrganization() returns null in PLAYWRIGHT_TEST mode (no
  // real session). Render the row structure either way so spec §F1's
  // "two distinct name surfaces" stays observable end-to-end.
  const clerkOrgName = organization?.name ?? ''

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="org-clerk-name" className="block text-sm font-medium text-gray-900">
          Organization name{' '}
          <span className="font-normal text-gray-400">
            (read-only — managed in your identity provider)
          </span>
        </label>
        <input
          id="org-clerk-name"
          type="text"
          value={clerkOrgName}
          readOnly
          disabled
          aria-label="Organization name"
          className="mt-1 w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Managed in your identity provider. Rename via the organization menu in the top-left
          → Manage.
        </p>
      </div>

      <div>
        <label htmlFor="brand-name" className="block text-sm font-medium text-gray-900">
          Brand name <span className="text-red-600">*</span>
        </label>
        <input
          id="brand-name"
          type="text"
          aria-label="Brand name"
          aria-invalid={errors.name ? 'true' : 'false'}
          placeholder="e.g., Acme Coffee Roasters"
          {...register('name')}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {errors.name.message ?? 'Required.'}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Customer-facing display name (member portals, surveys, emails). Independent of your
          identity-provider organization name.
        </p>
      </div>

      <div>
        <label htmlFor="logo-url" className="block text-sm font-medium text-gray-900">
          Logo URL
        </label>
        <input
          id="logo-url"
          type="url"
          aria-label="Logo URL"
          placeholder="https://your-cdn.example.com/logo.png"
          {...register('logoUrl')}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.logoUrl ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.logoUrl && (
          <p className="mt-1 text-xs font-medium text-red-600">{errors.logoUrl.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Customer-facing logo. Paste an https URL — file-picker upload is shipping in #305.
        </p>
      </div>

      <div>
        <label htmlFor="site-domain" className="block text-sm font-medium text-gray-900">
          Website
        </label>
        <input
          id="site-domain"
          type="text"
          aria-label="Website"
          placeholder="acmecoffee.com"
          {...register('siteDomain')}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            errors.siteDomain ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.siteDomain && (
          <p className="mt-1 text-xs font-medium text-red-600">{errors.siteDomain.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Hostname only — no <code className="rounded bg-gray-100 px-1">https://</code> or path.
        </p>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-900">
          Org size <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <div role="radiogroup" aria-label="Org size" className="mt-2 flex flex-wrap gap-2">
          {ORG_SIZES.map((opt) => {
            const selected = orgSize === opt.value
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={selected}
                  onChange={() =>
                    setValue('orgSize', opt.value, { shouldDirty: true, shouldValidate: true })
                  }
                />
                {opt.label}
              </label>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">For internal segmentation. Not shown elsewhere.</p>
      </div>
    </div>
  )
}
