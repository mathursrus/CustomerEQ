// Issue #524 — old-key usage telemetry recorder (R33).
//
// During an active identifier migration (PROCESSING or grace), inbound requests
// that resolve an existing member via the OLD identifier are counted per ingress
// source, bucketed by UTC day. R34 surfaces these per-ingress counts; R37 sums
// the trailing 7 days to decide the pre-expiry warning.

import type { PrismaClient, MigrationOldKeyIngress } from '@prisma/client'

/** Truncate a timestamp to UTC midnight (the day-bucket key). */
export function utcDayBucket(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
}

/**
 * Increment the (migration, ingress, day) old-key counter. Idempotent per call
 * (upsert + atomic increment). Best-effort: telemetry must never break the hot
 * resolution path, so callers may ignore failures — but we surface them to the
 * caller's logger rather than swallowing silently.
 */
export async function recordOldKeyUsage(
  prisma: PrismaClient,
  migrationId: string,
  brandId: string,
  ingress: MigrationOldKeyIngress,
  at: Date = new Date(),
): Promise<void> {
  const dayBucket = utcDayBucket(at)
  await prisma.memberIdentifierMigrationOldKeyUsage.upsert({
    where: { migrationId_ingress_dayBucket: { migrationId, ingress, dayBucket } },
    create: { migrationId, brandId, ingress, dayBucket, count: 1 },
    update: { count: { increment: 1 } },
  })
}
