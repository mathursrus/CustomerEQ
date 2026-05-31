'use client'

// Issue #524 Slice 1 — per-status panels for the migration detail page and the
// (compact) inline section reuse. Each panel is a pure presentation of a
// Migration plus the callbacks it needs (extend / retry / refetch). Mock scenes
// 6 / 7 / 7B / 7Bw / 7C / 8.

import { useState } from 'react'
import {
  type Migration,
  type OldKeyIngress,
} from '@/lib/migrations'
import {
  Badge,
  Callout,
  daysUntil,
  formatDate,
  INGRESS_LABELS,
  INGRESS_ORDER,
  ProgressBar,
  StatCard,
  StatGrid,
} from './shared'

// ───────────────────────────── PROCESSING ──────────────────────────────────

export function MigrationProgressPanel({ migration }: { migration: Migration }) {
  return (
    <div className="space-y-4">
      <ProgressBar value={migration.processedMembers} total={migration.totalMembers} />
      <StatGrid>
        <StatCard value={migration.totalMembers} label="Total" />
        <StatCard tone="ok" value={migration.processedMembers} label="Migrated" />
        <StatCard value={migration.remainingMembers} label="Remaining" />
        <StatCard
          tone={migration.failedMembers > 0 ? 'bad' : 'ok'}
          value={migration.failedMembers}
          label="Failed"
        />
      </StatGrid>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500 ring-4 ring-green-100"
          aria-hidden="true"
        />
        Live — incoming feedback during migration is matched on the old Customer ID and reconciled
        automatically. No action needed.
      </div>
    </div>
  )
}

// ───────────────────────────── grace table ─────────────────────────────────

function OldKeyTable({
  migration,
  danger,
}: {
  migration: Migration
  danger: boolean
}) {
  const entries = INGRESS_ORDER.map((ingress: OldKeyIngress) => ({
    ingress,
    count: migration.oldKeyUsage[ingress] ?? 0,
  }))
  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500">
            <th className="px-3 py-2 font-semibold uppercase tracking-wide">Integration surface</th>
            <th className="px-3 py-2 font-semibold uppercase tracking-wide">Old-key activity</th>
            <th className="px-3 py-2 font-semibold uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ ingress, count }) => (
            <tr key={ingress} className="border-t border-gray-200 text-gray-700">
              <td className="px-3 py-2">{INGRESS_LABELS[ingress]}</td>
              <td className="px-3 py-2">{count.toLocaleString()}</td>
              <td className="px-3 py-2">
                {count === 0 ? (
                  <Badge tone="success">✓ Cut over</Badge>
                ) : danger ? (
                  <Badge tone="danger">⚠ Not cut over</Badge>
                ) : (
                  <Badge tone="warn">Cutover pending</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────────────────────── REKEY_COMPLETE_IN_GRACE ─────────────────────────

export function GraceStatusPanel({
  migration,
  onExtend,
}: {
  migration: Migration
  onExtend: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const remaining = daysUntil(migration.graceExpiresAt)
  const danger = remaining <= 7
  const deadline = formatDate(migration.graceExpiresAt)

  async function extend() {
    setBusy(true)
    try {
      await onExtend()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {danger ? (
          <Badge tone="danger">⚠ Grace expires in {remaining} days</Badge>
        ) : (
          <Badge tone="warn">Grace window — {remaining} days remaining</Badge>
        )}
        <span className="text-sm text-gray-500">
          Now identifying members by Email. Old Customer ID accepted until{' '}
          <strong className="text-gray-700">{deadline}</strong>.
        </span>
      </div>

      {migration.reconciledMembers > 0 && (
        <Callout tone="success">
          <strong className="font-semibold">
            {migration.reconciledMembers.toLocaleString()} record
            {migration.reconciledMembers === 1 ? '' : 's'} that arrived during migration
          </strong>{' '}
          {migration.reconciledMembers === 1 ? 'was' : 'were'} matched on the old Customer ID and
          reconciled automatically.
        </Callout>
      )}

      <Callout tone={danger ? 'danger' : 'warn'}>
        {danger ? (
          <>
            <strong className="font-semibold">Some integrations have not been cut over.</strong> If
            they’re still sending Customer ID after {deadline}, those requests will be rejected.
            Extend the grace window if you need more time — it’s a one-click action.
          </>
        ) : (
          <>
            <strong className="font-semibold">
              Some of your integrations may still be sending the old Customer ID.
            </strong>{' '}
            Update them before {deadline}, when we’ll start rejecting those requests.
          </>
        )}
      </Callout>

      <OldKeyTable migration={migration} danger={danger} />

      <button
        type="button"
        onClick={() => void extend()}
        disabled={busy}
        className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Extending…' : 'Extend grace window +30 days'}
      </button>
    </div>
  )
}

// ───────────────────────────── GRACE_EXPIRED ───────────────────────────────

export function GraceExpiredPanel({ migration }: { migration: Migration }) {
  return (
    <div className="space-y-3">
      <Callout tone="success">
        <strong className="font-semibold">Cutover complete.</strong> The grace window has closed.
        Members are now identified by Email and the old Customer ID is no longer accepted.
      </Callout>
      <p className="text-sm text-gray-500">
        Email is in use. {migration.totalMembers.toLocaleString()} members were re-keyed.
      </p>
    </div>
  )
}

// ───────────────────────────── FAILED ──────────────────────────────────────

export function MigrationFailedPanel({
  migration,
  onRetry,
}: {
  migration: Migration
  onRetry: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    try {
      await onRetry()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Callout tone="warn">
        <strong className="font-semibold">Migration didn’t complete and was rolled back.</strong>{' '}
        Your members are unchanged and still identified by Customer ID. You can retry below.
      </Callout>
      <StatGrid>
        <StatCard value={migration.totalMembers} label="Total" />
        <StatCard value={migration.processedMembers} label="Processed before failure" />
        <StatCard tone="bad" value={migration.failedMembers} label="Errors" />
        <StatCard value={migration.fromKind} label="Method (unchanged)" />
      </StatGrid>
      {migration.errorRows.length > 0 && (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">Customer ID</th>
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">New email</th>
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">Error</th>
              </tr>
            </thead>
            <tbody>
              {migration.errorRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-700">{row.customerId}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{row.newEmail}</td>
                  <td className="px-3 py-2 text-red-600">{row.error || 'Write failed — safe to retry.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => void retry()}
        disabled={busy}
        className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Retrying…' : 'Retry migration'}
      </button>
    </div>
  )
}
