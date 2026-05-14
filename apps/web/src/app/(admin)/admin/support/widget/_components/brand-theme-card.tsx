'use client'

import Link from 'next/link'

const SWATCHES = ['#5b4cf0', '#0b0d12', '#f5f6fa', '#e2ddff', '#ffffff']

export function BrandThemeCard() {
  return (
    <aside className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-violet-50 shadow-sm">
      <div className="px-4 pt-4">
        <h2 className="text-sm font-bold text-gray-900">Colors, logo &amp; fonts</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          The widget uses your brand theme. Edit it to change primary color, accent, fonts, or upload your logo.
        </p>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex gap-1.5" aria-hidden>
          {SWATCHES.map((c) => (
            <span
              key={c}
              className="h-5 w-5 rounded-full ring-2 ring-white"
              style={{ backgroundColor: c, borderColor: 'rgba(11,13,18,0.08)' }}
            />
          ))}
        </div>
        <Link
          href="/admin/settings/themes"
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-600 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          Manage theme
          <span aria-hidden>→</span>
        </Link>
      </div>
    </aside>
  )
}
