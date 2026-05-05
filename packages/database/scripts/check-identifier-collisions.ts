#!/usr/bin/env tsx
/**
 * Pre-migration collision guard for Issue #231 (Survey response data model rework).
 *
 * The migration `20260504000000_survey_response_data_model_rework` adds a UNIQUE
 * INDEX on `members(brandId, externalId)` after backfilling
 * `externalId = LOWER(TRIM(email))`. If two existing members under the same
 * brand have email values that case-/whitespace-collide (e.g. `Bob@x.com` and
 * `bob@x.com`), the UNIQUE INDEX creation will fail mid-migration and the
 * transaction will roll back — leaving the engineer to clean up duplicates
 * blind.
 *
 * This script runs the same `(brandId, LOWER(TRIM(email)))` aggregation that
 * the migration depends on, surfaces any collisions as a CSV report, and exits
 * non-zero if any collisions exist. Intended to run as a CI pre-migration step
 * (and can be run locally before `pnpm db:migrate:dev` against staging snapshots).
 *
 * Exit codes:
 *   0 — no collisions; safe to migrate
 *   1 — collisions detected; CSV printed to stdout, do not migrate
 *   2 — script error (DB unreachable, query failure)
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx packages/database/scripts/check-identifier-collisions.ts
 *
 * The script honors the project's "tests must never skip" rule — if
 * DATABASE_URL is missing or unreachable, it FAILS LOUDLY rather than
 * silently passing.
 */

import { PrismaClient } from '@prisma/client'

interface CollisionRow {
  brandId: string
  normalizedEmail: string
  count: number
  memberIds: string[]
  emails: string[]
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL is not set. Cannot verify migration safety.')
    process.exit(2)
  }

  const prisma = new PrismaClient()

  try {
    // Find any (brandId, lower(trim(email))) tuple that appears more than once.
    // Returns the member ids and original email values so the operator can see
    // which rows need merging.
    const collisions = await prisma.$queryRaw<CollisionRow[]>`
      SELECT
        m."brandId"                              AS "brandId",
        LOWER(TRIM(m."email"))                   AS "normalizedEmail",
        COUNT(*)::int                            AS "count",
        ARRAY_AGG(m."id"    ORDER BY m."createdAt") AS "memberIds",
        ARRAY_AGG(m."email" ORDER BY m."createdAt") AS "emails"
      FROM "members" m
      GROUP BY m."brandId", LOWER(TRIM(m."email"))
      HAVING COUNT(*) > 1
      ORDER BY "count" DESC, m."brandId";
    `

    if (collisions.length === 0) {
      console.log('OK: no (brandId, LOWER(TRIM(email))) collisions found. Migration is safe.')
      process.exit(0)
    }

    // Collisions exist — emit a CSV report for the operator.
    console.error(`FAIL: ${collisions.length} (brandId, normalizedEmail) collision group(s) detected.`)
    console.error('Resolve these duplicates before running migration 20260504000000_survey_response_data_model_rework.\n')
    console.log('brandId,normalizedEmail,count,memberIds,emails')
    for (const row of collisions) {
      const memberIds = row.memberIds.join('|')
      const emails = row.emails.map((e) => e.replace(/"/g, '""')).join('|')
      console.log(`"${row.brandId}","${row.normalizedEmail}",${row.count},"${memberIds}","${emails}"`)
    }
    process.exit(1)
  } catch (err) {
    console.error('FATAL: collision-guard query failed.')
    console.error(err instanceof Error ? err.stack ?? err.message : String(err))
    process.exit(2)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('FATAL: unexpected error in collision guard.')
  console.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(2)
})
