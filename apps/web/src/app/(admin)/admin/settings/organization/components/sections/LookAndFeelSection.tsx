'use client'

import Link from 'next/link'
import { useFormContext } from 'react-hook-form'
import type { OrgFormValues, BrandTheme } from '../../lib/types'

// Issue #292 Slice 4 — Look & Feel (defaultThemeId picker). Spec §F4.
// Themes seeded by Slice 3 lazy-upsert (4 stock + brand customs).

interface LookAndFeelSectionProps {
  themes: BrandTheme[]
}

export function LookAndFeelSection({ themes }: LookAndFeelSectionProps) {
  const { register, watch, setValue } = useFormContext<OrgFormValues>()
  const selectedThemeId = watch('defaultThemeId')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2.5">
        <span className="text-sm text-indigo-900">
          Customize the stock themes or create a new one in <strong>Settings → Themes</strong>.
        </span>
        <Link
          href="/admin/settings/themes"
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Open Themes →
        </Link>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-900">Default theme</span>
        <div
          role="radiogroup"
          aria-label="Default theme"
          className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white"
        >
          {themes.length === 0 ? (
            // Issue #405 — replaces the prior "refresh after the API seeds
            // defaults" copy. The lazy-upsert self-heal in admin-brand-profile
            // now seeds defaults on first GET for any themeless brand, so this
            // empty state is reachable only if a manual deletion or future
            // bug regression occurs. Prescriptive action — admin-only surface,
            // existing "Open Themes →" link in the banner above handles the
            // jump.
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No themes are configured for this brand yet. Use{' '}
              <strong>Settings → Themes</strong> to add the first one.
            </p>
          ) : (
            themes.map((t) => {
              const selected = selectedThemeId === t.id
              return (
                <label
                  key={t.id}
                  className={`grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 last:border-b-0 hover:bg-gray-50 ${
                    selected ? 'bg-indigo-50' : ''
                  }`}
                >
                  <input
                    type="radio"
                    value={t.id}
                    checked={selected}
                    onChange={() =>
                      setValue('defaultThemeId', t.id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className="accent-indigo-600"
                  />
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    {t.name}
                    {selected && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="inline-flex gap-1">
                    {t.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded border border-gray-200"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </span>
                </label>
              )
            })
          )}
        </div>
        {/* register hidden so RHF tracks defaultThemeId for dirty detection */}
        <input type="hidden" {...register('defaultThemeId')} />
        <p className="mt-2 text-xs text-gray-500">
          Applied to surveys, member portals, and rich-format emails.
        </p>
      </div>
    </div>
  )
}
