'use client'

import { useState } from 'react'
import type { BrandProfile } from '../../lib/types'

// Issue #292 Slice 4 — Developer & Support reference. Spec §F11–§F14.
// Section is collapsed by default per spec ("admins do not need to
// interact with it for normal operation").

interface DeveloperSupportSectionProps {
  brand: Pick<BrandProfile, 'id' | 'clerkOrgId' | 'createdAt'>
  supportEmail: string
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <code className="select-all break-all font-mono text-xs text-gray-900">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          })
        }}
        className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function DeveloperSupportSection({ brand, supportEmail }: DeveloperSupportSectionProps) {
  return (
    <div className="space-y-2.5">
      <CopyRow label="Brand id" value={brand.id} />
      <CopyRow label="Clerk org id" value={brand.clerkOrgId} />
      <CopyRow label="Created" value={new Date(brand.createdAt).toISOString()} />
      <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5">
        <span className="text-xs font-medium text-gray-500">Support contact</span>
        <a
          href={`mailto:${supportEmail}`}
          className="break-all font-mono text-xs text-indigo-600 hover:underline"
        >
          {supportEmail}
        </a>
        <span className="text-xs text-gray-400">mailto:</span>
      </div>
    </div>
  )
}
