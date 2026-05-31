// Issue #524 — reconciliation of late-arriving members (R20, R21, §F).
//
// A member enrolled under the OLD identifier between the start of the re-key and
// the end of grace has its own Member row (its externalId is the old-shape value;
// nothing in the mapping pointed at it). It is never stranded — a primary lookup
// by that old-shape externalId still resolves it directly — but it is not yet
// recorded in the migration's mapping. This sweep records each such "orphan"
// member as a mapping row (oldExternalId == newExternalId == its current
// externalId; appliedAt = now) and bumps `reconciledMembers` so the completion
// summary (R22) is accurate.
//
// Slice-1 scope: this records and counts. It deliberately does NOT merge a phantom
// into a pre-existing migrated member that shares a new email — that re-parenting
// question is the documented open item in the RFC Confidence Level and is not
// auto-resolved here. No member is ever hard-deleted (R21).

import type { PrismaClient } from '@prisma/client'

export type ReconcileResult = { reconciled: number }

/**
 * Idempotent reconciliation sweep for one migration. Safe to call multiple times
 * (end-of-rekey and at grace expiry): already-mapped members are excluded, and
 * the unique (migrationId, memberId) constraint backstops any race.
 */
export async function reconcileMigration(
  prisma: PrismaClient,
  migrationId: string,
): Promise<ReconcileResult> {
  const migration = await prisma.memberIdentifierMigration.findUniqueOrThrow({
    where: { id: migrationId },
    select: { brandId: true, createdAt: true },
  })

  const mapped = await prisma.memberIdentifierMigrationMapping.findMany({
    where: { migrationId },
    select: { memberId: true },
  })
  const mappedIds = mapped.map((m) => m.memberId)

  // Orphans: live members in this brand created at/after the migration started
  // that have no mapping row yet. Erased / soft-deleted members are excluded —
  // the migration never touches them (mask-on-read erasure contract).
  const orphans = await prisma.member.findMany({
    where: {
      brandId: migration.brandId,
      createdAt: { gte: migration.createdAt },
      erased: false,
      deletedAt: null,
      id: { notIn: mappedIds },
    },
    select: { id: true, externalId: true },
  })

  let reconciled = 0
  for (const orphan of orphans) {
    try {
      await prisma.memberIdentifierMigrationMapping.create({
        data: {
          migrationId,
          memberId: orphan.id,
          oldExternalId: orphan.externalId,
          newExternalId: orphan.externalId, // phantom keeps its old-shape key (no email yet)
          appliedAt: new Date(),
        },
      })
      reconciled++
    } catch {
      // Unique (migrationId, memberId) violation → already reconciled by a
      // concurrent sweep. Skip without counting.
    }
  }

  if (reconciled > 0) {
    await prisma.memberIdentifierMigration.update({
      where: { id: migrationId },
      data: { reconciledMembers: { increment: reconciled } },
    })
  }

  return { reconciled }
}
