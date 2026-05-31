'use client'

// Issue #524 Slice 1 — migration detail / status page. Polls the migration
// (2s) while it is actively PROCESSING or in grace, then renders the panel for
// the current status. Mock scenes 6 / 7 / 7B / 7Bw / 7C / 8.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { usePollingQuery } from '@/lib/hooks/usePollingQuery'
import { extendGrace, getMigration, startMigration, type Migration } from '@/lib/migrations'
import { Badge } from '../_components/shared'
import {
  GraceExpiredPanel,
  GraceStatusPanel,
  MigrationFailedPanel,
  MigrationProgressPanel,
} from '../_components/panels'

const POLL_MS = 2_000
const SETTINGS_HREF = '/admin/settings/organization'

export default function MigrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getToken } = useAuth()

  const fetchFn = useCallback(() => getMigration(getToken, id), [getToken, id])

  // Poll while the migration is live (PROCESSING or in grace); stop on terminal
  // states (complete-expired / failed / cancelled / setup) so we don't poll a
  // finished migration forever. Start enabled so the first load always runs.
  const [polling, setPolling] = useState(true)
  const { data, loading, error, refetch } = usePollingQuery<Migration>({
    fetchFn,
    intervalMs: POLL_MS,
    enabled: polling,
  })
  useEffect(() => {
    if (!data) return
    const live = data.status === 'PROCESSING' || data.status === 'REKEY_COMPLETE_IN_GRACE'
    setPolling(live)
  }, [data])

  const handleExtend = useCallback(async () => {
    await extendGrace(getToken, id, 30)
    await refetch()
  }, [getToken, id, refetch])

  const handleRetry = useCallback(async () => {
    await startMigration(getToken, id, 'Retry after failure')
    await refetch()
  }, [getToken, id, refetch])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-2xl text-sm text-gray-500" aria-busy="true">
        Loading migration…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl text-sm text-gray-500">Migration not found.</div>
    )
  }

  const migration = data

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
        <Link href={SETTINGS_HREF} className="hover:text-indigo-700 hover:underline">
          Organization settings
        </Link>{' '}
        › <span className="font-medium text-gray-700">Member identifier migration</span>
      </nav>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 pb-3 pt-4">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-lg font-semibold text-gray-900">
              Member identifier migration <StatusBadge migration={migration} />
            </h1>
            <p className="m-0 mt-0.5 text-sm text-gray-500">
              Switching from {migration.fromKind} to {migration.toKind}.
            </p>
          </div>
        </header>

        <div className="px-5 py-4">
          <Body migration={migration} onExtend={handleExtend} onRetry={handleRetry} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ migration }: { migration: Migration }) {
  switch (migration.status) {
    case 'PROCESSING':
      return <Badge tone="info">Migrating</Badge>
    case 'REKEY_COMPLETE_IN_GRACE':
      return <Badge tone="warn">Grace window</Badge>
    case 'GRACE_EXPIRED':
      return <Badge tone="success">✓ Cutover complete</Badge>
    case 'FAILED':
      return <Badge tone="danger">Migration failed</Badge>
    case 'CANCELLED':
      return <Badge tone="muted">Cancelled</Badge>
    default:
      return <Badge tone="muted">Setup in progress</Badge>
  }
}

function Body({
  migration,
  onExtend,
  onRetry,
}: {
  migration: Migration
  onExtend: () => Promise<void>
  onRetry: () => Promise<void>
}) {
  switch (migration.status) {
    case 'PROCESSING':
      return <MigrationProgressPanel migration={migration} />
    case 'REKEY_COMPLETE_IN_GRACE':
      return <GraceStatusPanel migration={migration} onExtend={onExtend} />
    case 'GRACE_EXPIRED':
      return <GraceExpiredPanel migration={migration} />
    case 'FAILED':
      return <MigrationFailedPanel migration={migration} onRetry={onRetry} />
    case 'PENDING_VALIDATION':
    case 'VALIDATED':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p>Your migration setup isn’t finished yet. Pick up where you left off.</p>
          <Link
            href="/admin/settings/organization/migrations/new"
            className="inline-flex rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Resume setup →
          </Link>
        </div>
      )
    case 'CANCELLED':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p>This migration was cancelled. You can start a new one whenever you’re ready.</p>
          <Link
            href="/admin/settings/organization/migrations/new"
            className="inline-flex rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start a new migration →
          </Link>
        </div>
      )
    default:
      return null
  }
}
