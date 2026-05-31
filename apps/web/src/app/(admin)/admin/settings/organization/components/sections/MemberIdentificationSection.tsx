'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useFormContext } from 'react-hook-form'
import type { OrgFormValues, MemberIdentifierKind } from '../../lib/types'
import { getCurrentMigration, type Migration } from '@/lib/migrations'
import {
  MigrationProgressPanel,
  GraceStatusPanel,
  GraceExpiredPanel,
} from '../../migrations/_components/panels'
import { Badge } from '../../migrations/_components/shared'

// Issue #292 Slice 4 — Member identification. Spec §F6.
// Issue #524 Slice 1 — the locked panel now drives the guided migration:
// it reads the brand's current migration (client) and renders inline state
// (progress / grace / cutover / failed / setup-in-progress / entry link)
// instead of the old mailto:support dead-end.
//
// Lock semantics: when memberCount > 0, all radios disabled on first paint;
// the kind only changes via the guided flow, never by toggling a radio.

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

const MIGRATIONS_NEW_HREF = '/admin/settings/organization/migrations/new'

interface MemberIdentificationSectionProps {
  memberCount: number
  // Retained to avoid breaking the caller; the mailto: support path was removed
  // in Slice 1 (the locked panel now drives the guided migration instead).
  supportEmail?: string
}

export function MemberIdentificationSection({ memberCount }: MemberIdentificationSectionProps) {
  const { watch, setValue } = useFormContext<OrgFormValues>()
  const { getToken } = useAuth()
  const value = watch('memberIdentifierKind')
  const locked = memberCount > 0

  const [migration, setMigration] = useState<Migration | null>(null)
  const [loadingMigration, setLoadingMigration] = useState(false)

  useEffect(() => {
    if (!locked) return
    let cancelled = false
    setLoadingMigration(true)
    void (async () => {
      try {
        const current = await getCurrentMigration(getToken)
        if (!cancelled) setMigration(current)
      } catch {
        // Non-fatal: fall back to the plain locked notice.
        if (!cancelled) setMigration(null)
      } finally {
        if (!cancelled) setLoadingMigration(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [locked, getToken])

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
        <LockedPanel
          memberCount={memberCount}
          kind={value}
          migration={migration}
          loading={loadingMigration}
        />
      ) : (
        <p className="text-xs text-gray-500">
          This option cannot be changed after a member is enrolled in your organization.
        </p>
      )}
    </div>
  )
}

function LockedPanel({
  memberCount,
  kind,
  migration,
  loading,
}: {
  memberCount: number
  kind: MemberIdentifierKind
  migration: Migration | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-500">
        Checking migration status…
      </div>
    )
  }

  // Active or completed migration drives the panel.
  if (migration) {
    const detailHref = `/admin/settings/organization/migrations/${migration.id}`
    switch (migration.status) {
      case 'PROCESSING':
        return (
          <PanelShell
            badge={<Badge tone="info">Migrating</Badge>}
            link={{ href: detailHref, label: 'View migration progress →' }}
          >
            <MigrationProgressPanel migration={migration} />
          </PanelShell>
        )
      case 'REKEY_COMPLETE_IN_GRACE':
        return (
          <PanelShell
            badge={<Badge tone="warn">Grace window</Badge>}
            link={{ href: detailHref, label: 'Manage grace window →' }}
          >
            {/* Extend is handled on the detail page; inline view is read-only. */}
            <GraceStatusPanel migration={migration} onExtend={() => {}} />
          </PanelShell>
        )
      case 'GRACE_EXPIRED':
        return (
          <PanelShell badge={<Badge tone="success">✓ Cutover complete</Badge>}>
            <GraceExpiredPanel migration={migration} />
          </PanelShell>
        )
      case 'FAILED':
        return (
          <div className="flex items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-3">
            <div className="flex-1 text-sm leading-relaxed text-amber-900">
              <strong className="font-semibold">The last migration failed and was rolled back.</strong>{' '}
              Your members are unchanged. You can review the details and retry.
            </div>
            <Link
              href={detailHref}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Resume →
            </Link>
          </div>
        )
      case 'PENDING_VALIDATION':
      case 'VALIDATED':
        return (
          <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3">
            <div className="flex-1 text-sm leading-relaxed text-gray-900">
              <strong className="font-semibold">Migration setup in progress.</strong> You started
              switching your identifier method but haven’t finished yet.
            </div>
            <Link
              href={MIGRATIONS_NEW_HREF}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Resume →
            </Link>
          </div>
        )
      default:
        break
    }
  }

  // No current migration. Offer the switch only for CUSTOMER_ID brands (Slice 1
  // supports CUSTOMER_ID → EMAIL only); other kinds get a plain locked notice.
  if (kind === 'CUSTOMER_ID') {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3">
        <div className="flex-1 text-sm leading-relaxed text-gray-900">
          <strong className="font-semibold">{memberCount.toLocaleString()} members enrolled.</strong>{' '}
          The identifier method is locked while members exist. To change it, run a guided migration —
          you’ll map each member to their new identifier and we migrate everything safely.
        </div>
        <Link
          href={MIGRATIONS_NEW_HREF}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Switch identifier method →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-relaxed text-gray-900">
      <strong className="font-semibold">{memberCount.toLocaleString()} members enrolled.</strong> The
      identifier method is locked while members exist.
    </div>
  )
}

function PanelShell({
  badge,
  link,
  children,
}: {
  badge: React.ReactNode
  link?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-white px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>{badge}</div>
        {link && (
          <Link href={link.href} className="text-xs font-medium text-indigo-700 hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}
