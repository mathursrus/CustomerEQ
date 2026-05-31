'use client'

// Issue #524 Slice 1 (R37) — brand-wide pre-expiry warning banner. Renders on
// every admin page when a migration's grace window is ≤7 days from expiry AND
// old-key traffic is still arriving on one or more ingress surfaces. The API
// (GET /admin/brand/usage-warnings) returns null otherwise, so this renders
// nothing in the common case.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { getUsageWarnings, type UsageWarning } from '@/lib/migrations'
import { INGRESS_LABELS } from '../admin/settings/organization/migrations/_components/shared'

export function UsageWarningBanner() {
  const { getToken } = useAuth()
  const [warning, setWarning] = useState<UsageWarning | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const w = await getUsageWarnings(getToken)
        if (!cancelled) setWarning(w)
      } catch {
        // Non-fatal: the banner is advisory; on error simply render nothing.
        if (!cancelled) setWarning(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  if (!warning) return null

  const integrations = warning.oldKeyIngressesActive
  const count = integrations.length

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3.5 rounded-lg border border-amber-200 border-l-[3px] border-l-amber-500 bg-amber-50 px-4 py-3.5"
    >
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white"
        aria-hidden="true"
      >
        !
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-amber-900">
          {warning.daysRemaining} day{warning.daysRemaining === 1 ? '' : 's'} until your Customer ID
          stops working — {count} integration{count === 1 ? '' : 's'} not yet updated
        </div>
        <div className="mt-1 text-sm leading-relaxed text-amber-900">
          {integrations.map((i, idx) => (
            <span key={i.ingress}>
              {idx > 0 && ', '}
              <span className="font-medium">{INGRESS_LABELS[i.ingress]}</span> (
              {i.count7d.toLocaleString()} in the last 7 days)
            </span>
          ))}{' '}
          {count === 1 ? 'is' : 'are'} still sending the old Customer ID.
        </div>
      </div>
      <Link
        href={`/admin/settings/organization/migrations/${warning.migrationId}`}
        className="shrink-0 self-center whitespace-nowrap rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        Review & extend →
      </Link>
    </div>
  )
}
