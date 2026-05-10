'use client'

import { useFormContext } from 'react-hook-form'
import type { OrgFormValues, MemberIdentifierKind } from '../../lib/types'

// Issue #292 Slice 4 — Member identification. Spec §F6.
// Lock semantics: when memberCount > 0, all radios disabled on first paint;
// no self-serve change path; mailto:SUPPORT_EMAIL surfaces for managed migration.

const OPTIONS: { value: MemberIdentifierKind; title: string; recommended?: boolean; desc: string }[] = [
  {
    value: 'EMAIL',
    title: 'Email',
    recommended: true,
    desc: 'Most common. Customers identify themselves with their email address. Case-insensitive matching.',
  },
  {
    value: 'PHONE',
    title: 'Phone number',
    desc: 'For SMS-led brands. Stored in E.164 format (e.g., +15551234567).',
  },
  {
    value: 'CUSTOMER_ID',
    title: 'Customer ID',
    desc: 'Bring-your-own external identifier — e.g., your application\'s internal customer key.',
  },
]

interface MemberIdentificationSectionProps {
  memberCount: number
  supportEmail: string
}

export function MemberIdentificationSection({
  memberCount,
  supportEmail,
}: MemberIdentificationSectionProps) {
  const { watch, setValue } = useFormContext<OrgFormValues>()
  const value = watch('memberIdentifierKind')
  const locked = memberCount > 0

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Member identifier kind" className="flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 rounded-md border bg-white px-3.5 py-3 ${
                locked
                  ? selected
                    ? 'cursor-not-allowed border-gray-300 bg-gray-50 opacity-100'
                    : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                  : selected
                    ? 'cursor-pointer border-indigo-500 bg-indigo-50'
                    : 'cursor-pointer border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                aria-label={opt.title}
                checked={selected}
                disabled={locked}
                onChange={() =>
                  setValue('memberIdentifierKind', opt.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="mt-0.5 shrink-0 accent-indigo-600 disabled:opacity-50"
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                  {opt.title}
                  {opt.recommended && (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">{opt.desc}</span>
              </span>
            </label>
          )
        })}
      </div>

      {locked ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3">
          <div className="flex-1 text-sm leading-relaxed text-gray-900">
            <strong className="font-semibold">{memberCount.toLocaleString()}+ members</strong> are
            already enrolled. The member identifier kind cannot be changed once members exist.
            Contact CustomerEQ Support to request a managed migration.
          </div>
          <a
            href={`mailto:${supportEmail}`}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Contact support
          </a>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          This option cannot be changed after a member is enrolled in your organization.
        </p>
      )}
    </div>
  )
}
