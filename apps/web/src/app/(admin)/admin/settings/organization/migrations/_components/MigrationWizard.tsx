'use client'

// Issue #524 Slice 1 — the 3-step "switch member identifier kind" wizard
// (mock scenes 2A/2B/3/4/5). On mount it POSTs to create the migration
// (handling 409 → redirect, 400 → unsupported-direction error), then loads the
// preflight context to decide the fast-path vs partial-coverage branch.
//
// Multi-step state follows the ManagedEmailFlow precedent: a single `step`
// useState plus visibility toggles; the confirm danger-button is gated on the
// attestation checkbox per the ImpliedAttestationModal pattern.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import {
  cancelMigration,
  createMigration,
  downloadMappingTemplate,
  getPreflightContext,
  MigrationInProgressError,
  startMigration,
  submitMappingCsv,
  submitMappingFromExisting,
  type Migration,
  type PreflightContext,
  type PreflightResult,
} from '@/lib/migrations'
import {
  Badge,
  Callout,
  impactSurfaceLabel,
  relativeTime,
  StatCard,
  StatGrid,
  Stepper,
  type StepState,
} from './shared'

type WizardStep = 'prepare' | 'upload' | 'confirm'

function stepStates(step: WizardStep, partial: boolean): Array<{ label: string; state: StepState }> {
  const order: WizardStep[] = ['prepare', 'upload', 'confirm']
  const idx = order.indexOf(step)
  const labels: Record<WizardStep, string> = {
    prepare: 'Choose & prepare',
    upload: partial ? 'Upload & validate' : 'Validate',
    confirm: 'Confirm & migrate',
  }
  return order.map((s, i) => ({
    label: labels[s],
    state: i < idx ? 'done' : i === idx ? 'active' : 'todo',
  }))
}

function attestationText(total: number): string {
  return `I confirm I have permission to use these email addresses, and I understand this re-keys all ${total.toLocaleString()} members and cannot be automatically undone.`
}

export function MigrationWizard() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [migration, setMigration] = useState<Migration | null>(null)
  const [context, setContext] = useState<PreflightContext | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  const [step, setStep] = useState<WizardStep>('prepare')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Upload step state.
  const [fileName, setFileName] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)

  // Confirm step state.
  const [attested, setAttested] = useState(false)

  // Create the migration + load preflight context on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const created = await createMigration(getToken)
        if (cancelled) return
        setMigration(created)
        const ctx = await getPreflightContext(getToken)
        if (cancelled) return
        setContext(ctx)
      } catch (e) {
        if (cancelled) return
        if (e instanceof MigrationInProgressError) {
          router.replace(e.conflict.redirectTo)
          return
        }
        setInitError(
          e instanceof Error
            ? e.message
            : 'Could not start the migration. Only organizations identifying members by Customer ID can switch to Email right now.',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken, router])

  const total = context?.counts.total ?? migration?.totalMembers ?? 0

  const handleCancel = useCallback(async () => {
    if (!migration) return
    setBusy(true)
    setActionError(null)
    try {
      await cancelMigration(getToken, migration.id)
      router.push('/admin/settings/organization')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel.')
      setBusy(false)
    }
  }, [migration, getToken, router])

  const handleUseExisting = useCallback(async () => {
    if (!migration) return
    setBusy(true)
    setActionError(null)
    try {
      const result = await submitMappingFromExisting(getToken, migration.id)
      if (result.ok) {
        setPreflight(result)
        setStep('confirm')
      } else {
        // Shouldn't happen on the fast path, but surface it rather than proceed.
        setPreflight(result)
        setStep('upload')
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }, [migration, getToken])

  const handleDownloadTemplate = useCallback(async () => {
    setActionError(null)
    try {
      await downloadMappingTemplate(getToken)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not download the template.')
    }
  }, [getToken])

  const handleFile = useCallback(
    async (file: File) => {
      if (!migration) return
      setBusy(true)
      setActionError(null)
      setFileName(file.name)
      try {
        const csv = await file.text()
        const result = await submitMappingCsv(getToken, migration.id, csv)
        setPreflight(result)
      } catch (e) {
        setPreflight(null)
        setActionError(e instanceof Error ? e.message : 'Could not parse the CSV.')
      } finally {
        setBusy(false)
      }
    },
    [migration, getToken],
  )

  const handleStart = useCallback(async () => {
    if (!migration) return
    setBusy(true)
    setActionError(null)
    try {
      await startMigration(getToken, migration.id, attestationText(total))
      router.push(`/admin/settings/organization/migrations/${migration.id}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start the migration.')
      setBusy(false)
    }
  }, [migration, getToken, total, router])

  // ───────────────────────── render guards ─────────────────────────────────

  if (initError) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {initError}
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/settings/organization')}
          className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back to organization settings
        </button>
      </div>
    )
  }

  if (!migration || !context) {
    return (
      <div className="text-sm text-gray-500" aria-busy="true">
        Preparing migration…
      </div>
    )
  }

  const partial = !context.fastPathAvailable
  const { counts } = context

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-200 px-5 pb-3 pt-4">
        <h1 className="m-0 text-lg font-semibold text-gray-900">
          {step === 'confirm' ? 'Confirm migration to Email' : 'Switch member identifier method'}
        </h1>
        <p className="m-0 mt-0.5 text-sm text-gray-500">
          {step === 'confirm'
            ? `${total.toLocaleString()} members will be re-identified by email.`
            : 'Currently identifying members by Customer ID.'}
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <Stepper steps={stepStates(step, partial)} />

        {actionError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* ─────────────── Step 1 — Choose & prepare ─────────────── */}
        {step === 'prepare' && (
          <>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-gray-900">New identifier method</legend>
              <label className="flex items-start gap-2.5 rounded-md border border-indigo-500 bg-indigo-50 px-3.5 py-3">
                <input type="radio" checked readOnly className="mt-0.5 shrink-0 accent-indigo-600" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-gray-900">Email</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Members will be identified by email address (case-insensitive).
                  </span>
                </span>
              </label>
              <label className="flex cursor-not-allowed items-start gap-2.5 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3 opacity-60">
                <input type="radio" disabled className="mt-0.5 shrink-0 accent-indigo-600" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                    Phone number
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      Available in a subsequent release
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">E.164 format.</span>
                </span>
              </label>
            </fieldset>

            {!partial ? (
              // Scene 2A — fast path.
              <>
                <Callout tone="success">
                  <strong className="font-semibold">
                    Good news — we already have an email for every member.
                  </strong>{' '}
                  You can switch using the emails on file; no upload needed. If you want to correct
                  or update some emails first, choose “Edit mapping before migrating” — it downloads
                  the mapping with every email pre-filled so you only edit what you need to change.
                </Callout>
                <StatGrid>
                  <StatCard tone="ok" value={counts.withEmail} label="Members with email" />
                  <StatCard
                    tone="ok"
                    value={counts.total - counts.invalidShape}
                    label="Valid email shape"
                  />
                  <StatCard tone="ok" value={counts.collisionGroups} label="Collisions" />
                  <StatCard tone="ok" value={0} label="Blocking issues" />
                </StatGrid>
              </>
            ) : (
              // Scene 2B — partial coverage.
              <>
                <Callout tone="info">
                  <strong className="font-semibold">
                    Partial coverage — {counts.withEmail.toLocaleString()} of{' '}
                    {counts.total.toLocaleString()} members have an email on file.
                  </strong>{' '}
                  The template is pre-filled with those existing emails; you only need to fill in the
                  remaining {counts.withoutEmail.toLocaleString()} rows. You can also edit pre-filled
                  rows if you want to override an existing email before migrating.
                </Callout>
                <div className="flex flex-col gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-indigo-900">
                    <strong className="font-semibold">Mapping template</strong> — customer_id,
                    new_email (pre-filled from existing emails)
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTemplate()}
                    className="shrink-0 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    ⬇ Download template (CSV)
                  </button>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={busy}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex flex-wrap gap-2">
                {!partial ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      disabled={busy}
                      className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Edit mapping before migrating
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUseExisting()}
                      disabled={busy}
                      className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busy ? 'Validating…' : 'Use existing emails →'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    disabled={busy}
                    className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Next: Upload mapping →
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─────────────── Step 2 — Upload & validate ─────────────── */}
        {step === 'upload' && (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900">Upload your filled mapping (CSV)</span>
              <input
                type="file"
                accept=".csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
              />
            </label>

            {fileName && (
              <div
                className={`flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5 ${
                  preflight?.ok
                    ? 'border-green-300 bg-green-50'
                    : preflight
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span aria-hidden="true">📄</span>
                <span className="flex-1 truncate text-sm font-medium text-gray-900">{fileName}</span>
                {preflight?.ok ? (
                  <Badge tone="success">✓ Validated</Badge>
                ) : preflight ? (
                  <Badge tone="danger">
                    {preflight.counts.unmappedMembers +
                      preflight.counts.collisions +
                      preflight.counts.invalidShape}{' '}
                    blocking issues
                  </Badge>
                ) : busy ? (
                  <Badge tone="muted">Validating…</Badge>
                ) : null}
              </div>
            )}

            {preflight && (
              <>
                <StatGrid>
                  <StatCard value={preflight.counts.totalRows} label="Rows in file" />
                  <StatCard
                    tone={preflight.counts.unmappedMembers === 0 ? 'ok' : 'neutral'}
                    value={preflight.counts.membersMatched}
                    label="Members matched"
                  />
                  <StatCard
                    tone={preflight.counts.unmappedMembers === 0 ? 'ok' : 'warn'}
                    value={preflight.counts.unmappedMembers}
                    label="Unmapped members"
                  />
                  <StatCard
                    tone={
                      preflight.counts.collisions + preflight.counts.invalidShape + preflight.counts.unmappedMembers ===
                      0
                        ? 'ok'
                        : 'bad'
                    }
                    value={
                      preflight.counts.collisions +
                      preflight.counts.invalidShape +
                      preflight.counts.unmappedMembers
                    }
                    label="Blocking issues"
                  />
                </StatGrid>

                {preflight.ok ? (
                  <Callout tone="info">
                    All members are accounted for and every new email is valid and unique. You’re
                    ready to migrate.
                  </Callout>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left text-gray-500">
                            <th className="px-3 py-2 font-semibold uppercase tracking-wide">Row</th>
                            <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                              Customer ID
                            </th>
                            <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                              New email
                            </th>
                            <th className="px-3 py-2 font-semibold uppercase tracking-wide">Issue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preflight.rowIssues.map((issue, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td className="px-3 py-2 font-mono text-gray-700">{issue.row ?? '—'}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">{issue.customerId}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">
                                {issue.newEmail ?? '—'}
                              </td>
                              <td className="px-3 py-2 text-red-600">{issue.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Callout tone="warn">
                      Fix these rows in your CSV and re-upload. Migration won’t start until there are
                      zero blocking issues — your members are untouched.
                    </Callout>
                  </>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setStep('prepare')}
                disabled={busy}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={busy || !preflight?.ok}
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Next: Review & confirm →
              </button>
            </div>
          </>
        )}

        {/* ─────────────── Step 3 — Confirm & migrate ─────────────── */}
        {step === 'confirm' && (
          <>
            <Callout tone="warn">
              <strong className="font-semibold">Brand-side updates you’ll need to make</strong> —
              these integrations are using your Customer ID today (ordered by most recent activity;
              surfaces with no activity in the last 30 days are omitted). You’ll have a{' '}
              <strong className="font-semibold">30-day grace window</strong> after migration to
              update them; we’ll continue accepting the old Customer ID alongside email during that
              time.
              {context.impactPreview.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-md border border-amber-200 bg-white">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-amber-50 text-left text-amber-800">
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                          Integration surface
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                          Activity (last 30d)
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {context.impactPreview.map((row, i) => (
                        <tr key={i} className="border-t border-amber-100 text-gray-700">
                          <td className="px-3 py-2">{impactSurfaceLabel(row.surface)}</td>
                          <td className="px-3 py-2">
                            {row.count30d.toLocaleString()}
                            {row.lastSeenAt ? ` · last ${relativeTime(row.lastSeenAt)}` : ''}
                          </td>
                          <td className="px-3 py-2">{row.brandSideAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm">
                  No integrations have used your Customer ID in the last 30 days.
                </p>
              )}
            </Callout>

            <Callout tone="info">
              <strong className="font-semibold">What happens next</strong>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                <li>Each member is re-keyed from their Customer ID to their new email.</li>
                <li>
                  Feedback received during the migration keeps working — it’s matched on the old
                  Customer ID and reconciled automatically.
                </li>
                <li>
                  After the kind switches to Email, a 30-day grace window begins — the old Customer
                  ID is still accepted; you’ll see remaining activity per surface and can extend if
                  needed.
                </li>
                <li>When finished, the change is recorded in your audit log.</li>
              </ul>
            </Callout>

            <label className="flex items-start gap-2.5 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-relaxed text-gray-900">
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
                className="mt-0.5 shrink-0 accent-indigo-600"
              />
              <span>{attestationText(total)}</span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setStep(partial ? 'upload' : 'prepare')}
                disabled={busy}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={busy || !attested}
                className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {busy ? 'Starting…' : `Migrate ${total.toLocaleString()} members`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
