import { getTestPrisma } from '../db/setup.js'

// Issue #524 — factories for identifier-migration integration tests.

let counter = 0

type MigrationStatus =
  | 'PENDING_VALIDATION'
  | 'VALIDATED'
  | 'PROCESSING'
  | 'REKEY_COMPLETE_IN_GRACE'
  | 'GRACE_EXPIRED'
  | 'FAILED'
  | 'CANCELLED'

type Kind = 'EMAIL' | 'PHONE' | 'CUSTOMER_ID'

export async function createMemberIdentifierMigration(opts: {
  brandId: string
  status?: MigrationStatus
  fromKind?: Kind
  toKind?: Kind
  totalMembers?: number
  rekeyCompletedAt?: Date | null
  graceExpiresAt?: Date | null
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.memberIdentifierMigration.create({
    data: {
      brandId: opts.brandId,
      fromKind: opts.fromKind ?? 'CUSTOMER_ID',
      toKind: opts.toKind ?? 'EMAIL',
      status: opts.status ?? 'PENDING_VALIDATION',
      totalMembers: opts.totalMembers ?? 0,
      rekeyCompletedAt: opts.rekeyCompletedAt ?? null,
      graceExpiresAt: opts.graceExpiresAt ?? null,
    },
  })
}

/** Create a mapping row for an existing member. Defaults oldEmail to null. */
export async function createMigrationMapping(opts: {
  migrationId: string
  memberId: string
  oldExternalId: string
  newExternalId: string
  oldEmail?: string | null
  appliedAt?: Date | null
}) {
  const prisma = getTestPrisma()
  return prisma.memberIdentifierMigrationMapping.create({
    data: {
      migrationId: opts.migrationId,
      memberId: opts.memberId,
      oldExternalId: opts.oldExternalId,
      newExternalId: opts.newExternalId,
      oldEmail: opts.oldEmail ?? null,
      appliedAt: opts.appliedAt ?? null,
    },
  })
}
