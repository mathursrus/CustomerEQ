// Issue #524 — member-identifier re-key worker (R15, R16, R17, R23) + grace
// expiry sweep (R31/R35, §G). Direction-agnostic: the worker reads fromKind/
// toKind off the batch row and sets the PII sidecar for the target kind. Slice 1
// wires CUSTOMER_ID → EMAIL (target sidecar = email).

import type { Job } from 'bullmq'
import { prisma } from '@customerEQ/database'
import { Prisma } from '@prisma/client'
import type { MemberIdentifierMigrationPayload } from '@customerEQ/shared'
import pino from 'pino'
import { reconcileMigration } from './migrationReconciliation.js'

const log = pino({ name: 'member-identifier-migration' })

const CHUNK = 200
const GRACE_DAYS = 30
const AUDIT_RESOURCE = 'member_identifier_migration'

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function emitMigrationAudit(
  action: string,
  brandId: string,
  migrationId: string,
  metadata: Prisma.InputJsonObject,
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      brandId,
      actorId: 'system',
      action,
      resourceType: AUDIT_RESOURCE,
      resourceId: migrationId,
      metadata,
    },
  })
}

export type RekeyResult = {
  status: string
  processed: number
  failed: number
  reconciled: number
}

/**
 * Core re-key dispatch (exported for inline runtime + tests). Idempotent on
 * restart: the cursor only picks up mappings that are not yet applied and have
 * no recorded error, so a crashed-and-resumed run continues where it left off.
 */
export async function dispatchMemberIdentifierMigration(
  payload: MemberIdentifierMigrationPayload,
): Promise<RekeyResult> {
  const { migrationId } = payload
  const migration = await prisma.memberIdentifierMigration.findUniqueOrThrow({
    where: { id: migrationId },
  })

  if (migration.status !== 'VALIDATED' && migration.status !== 'PROCESSING') {
    log.warn({ migrationId, status: migration.status }, 're-key skipped — not in a runnable state')
    return {
      status: migration.status,
      processed: migration.processedMembers,
      failed: migration.failedMembers,
      reconciled: migration.reconciledMembers,
    }
  }

  await prisma.memberIdentifierMigration.update({
    where: { id: migrationId },
    data: { status: 'PROCESSING' },
  })

  // Forward re-key in committed chunks → R18 live progress is visible to the
  // polling endpoint between chunks.
  let cursor: string | undefined
  for (;;) {
    const chunk = await prisma.memberIdentifierMigrationMapping.findMany({
      where: { migrationId, appliedAt: null, errorReason: null },
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: CHUNK,
    })
    if (chunk.length === 0) break
    cursor = chunk[chunk.length - 1].id

    for (const mapping of chunk) {
      try {
        await prisma.$transaction(async (tx) => {
          // R16 + R27: brandId-scoped, tenant-isolated re-key. Set the canonical
          // key and the target PII sidecar (EMAIL adapter) atomically.
          await tx.member.update({
            where: { id: mapping.memberId, brandId: migration.brandId },
            data: { externalId: mapping.newExternalId, email: mapping.newExternalId },
          })
          await tx.memberIdentifierMigrationMapping.update({
            where: { id: mapping.id },
            data: { appliedAt: new Date() },
          })
          await tx.memberIdentifierMigration.update({
            where: { id: migrationId },
            data: { processedMembers: { increment: 1 } },
          })
        })
      } catch (err) {
        await prisma.memberIdentifierMigrationMapping.update({
          where: { id: mapping.id },
          data: { errorReason: messageOf(err) },
        })
        await prisma.memberIdentifierMigration.update({
          where: { id: migrationId },
          data: { failedMembers: { increment: 1 } },
        })
        log.error({ migrationId, memberId: mapping.memberId, err }, 're-key failed for member')
      }
    }
  }

  const final = await prisma.memberIdentifierMigration.findUniqueOrThrow({
    where: { id: migrationId },
  })

  if (final.failedMembers === 0) {
    // R17 — flip the brand kind LAST, only on terminal success, in one tx with
    // the status transition + grace-window start.
    const now = new Date()
    const graceExpiresAt = addDays(now, GRACE_DAYS)
    await prisma.$transaction([
      prisma.brand.update({
        where: { id: migration.brandId },
        data: { memberIdentifierKind: migration.toKind, activeMigrationId: migrationId },
      }),
      prisma.memberIdentifierMigration.update({
        where: { id: migrationId },
        data: { status: 'REKEY_COMPLETE_IN_GRACE', rekeyCompletedAt: now, graceExpiresAt },
      }),
    ])
    await emitMigrationAudit('brand.identifier_migration.completed', migration.brandId, migrationId, {
      before: migration.fromKind,
      after: migration.toKind,
      totalMembers: final.totalMembers,
      processedMembers: final.processedMembers,
      reconciledMembers: final.reconciledMembers,
      graceExpiresAt: graceExpiresAt.toISOString(),
    })
    // One-shot reconciliation for members that enrolled on the old key during
    // the re-key window (R20).
    const { reconciled } = await reconcileMigration(prisma, migrationId)
    log.info({ migrationId, processed: final.processedMembers, reconciled }, 're-key complete; in grace')
    return { status: 'REKEY_COMPLETE_IN_GRACE', processed: final.processedMembers, failed: 0, reconciled }
  }

  // R23 — terminal failure: compensate already-applied members back to their
  // original key so no member is left stranded, then mark FAILED. The brand kind
  // was never flipped (only flips on success above).
  await rollbackAppliedMembers(migrationId, migration.brandId)
  await prisma.memberIdentifierMigration.update({
    where: { id: migrationId },
    data: { status: 'FAILED' },
  })
  const errorSample = await prisma.memberIdentifierMigrationMapping.findMany({
    where: { migrationId, errorReason: { not: null } },
    select: { memberId: true, errorReason: true },
    take: 5,
  })
  await emitMigrationAudit('brand.identifier_migration.failed', migration.brandId, migrationId, {
    failedMembers: final.failedMembers,
    errorSample,
  })
  log.error({ migrationId, failed: final.failedMembers }, 're-key failed; rolled back, kind unchanged')
  return { status: 'FAILED', processed: final.processedMembers, failed: final.failedMembers, reconciled: 0 }
}

/**
 * Compensating rollback (R23). Reverts every applied mapping's member to its
 * pre-migration externalId + email, and clears `appliedAt` so a subsequent retry
 * (R24) re-processes it. `errorReason` is preserved for the failed rows so the
 * admin still sees per-member errors until they retry.
 */
async function rollbackAppliedMembers(migrationId: string, brandId: string): Promise<void> {
  let cursor: string | undefined
  for (;;) {
    const applied = await prisma.memberIdentifierMigrationMapping.findMany({
      where: { migrationId, appliedAt: { not: null } },
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: CHUNK,
    })
    if (applied.length === 0) break
    cursor = applied[applied.length - 1].id

    for (const mapping of applied) {
      await prisma.$transaction(async (tx) => {
        await tx.member.update({
          where: { id: mapping.memberId, brandId },
          data: { externalId: mapping.oldExternalId, email: mapping.oldEmail },
        })
        await tx.memberIdentifierMigrationMapping.update({
          where: { id: mapping.id },
          data: { appliedAt: null },
        })
      })
    }
  }
}

export async function processMemberIdentifierMigration(
  job: Job<MemberIdentifierMigrationPayload>,
): Promise<RekeyResult> {
  return dispatchMemberIdentifierMigration(job.data)
}

// ───────────────────────────── Grace-expiry sweep (§G) ─────────────────────

export type GraceSweepResult = { expired: number }

/**
 * Flip every REKEY_COMPLETE_IN_GRACE migration whose deadline has passed to
 * GRACE_EXPIRED, run a final reconciliation sweep, and audit the transition.
 * Correctness does not depend on sub-minute timing — request-time rejection
 * (R35) gates on `status`, not `now()`.
 */
export async function dispatchGraceExpirySweep(at: Date = new Date()): Promise<GraceSweepResult> {
  const due = await prisma.memberIdentifierMigration.findMany({
    where: { status: 'REKEY_COMPLETE_IN_GRACE', graceExpiresAt: { lte: at } },
    select: { id: true, brandId: true },
  })
  for (const migration of due) {
    await reconcileMigration(prisma, migration.id)
    await prisma.memberIdentifierMigration.update({
      where: { id: migration.id },
      data: { status: 'GRACE_EXPIRED' },
    })
    await emitMigrationAudit('brand.identifier_migration.grace_expired', migration.brandId, migration.id, {
      expiredAt: at.toISOString(),
    })
    log.info({ migrationId: migration.id }, 'grace window expired; old key now rejected')
  }
  return { expired: due.length }
}

export async function processGraceExpirySweep(_job: Job): Promise<GraceSweepResult> {
  return dispatchGraceExpirySweep()
}
