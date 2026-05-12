/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupMigrationTestDb, type MigrationTestDbHandle } from '@customerEQ/config/test-utils'

/**
 * Issue #241 Slice 1 — D50 fan-out migration verification.
 *
 * Five brand-fixture scenarios from the RFC (`docs/rfcs/241-survey-admin-ux.md`
 * § Schema Changes / Fixture coverage). Each brand is seeded into a sandbox
 * schema at the pre-migration state (where `Survey.incentivePoints` and
 * `Survey.showIncentivePoints` still exist and `SurveyStatus` still has the
 * `CLOSED` value), the Slice 1 migration is applied, and the post-state
 * `EarningRule` rows are asserted.
 *
 * Why a sandbox (not `setupTestDb`): `setupTestDb` uses `prisma db push` which
 * collapses all migrations into a single CREATE-from-schema pass and skips
 * the data migrations we want to exercise. `setupMigrationTestDb` replays
 * each migration's `migration.sql` in chronological order, lets the test seed
 * pre-state via raw SQL (the typed Prisma client reflects the post-migration
 * schema and so cannot see removed columns), then applies the target
 * migration on demand.
 */

const TARGET_MIGRATION = '20260512000000_survey_admin_ux_241_slice_1'

// Brand IDs are deterministic strings so post-migration assertions can target
// each fixture independently. Real brands use cuid(); these stand in for
// "brand X" in the fan-out logic and avoid factory coupling to a schema state
// the typed client can't represent.
const BRAND = {
  onlySurveyIncentive: 'brand_only_survey_incentive_241',
  onlyDeadRule: 'brand_only_dead_rule_241',
  both: 'brand_both_241',
  liveCxOnly: 'brand_live_cx_only_241',
  neither: 'brand_neither_241',
} as const

describe('Issue #241 Slice 1 — D50 fan-out migration', () => {
  let handle: MigrationTestDbHandle

  beforeAll(async () => {
    handle = await setupMigrationTestDb({ stopBefore: TARGET_MIGRATION })

    // ---- Fixture 1: brand-only-survey-incentive ----
    // 3 NPS surveys, all with incentivePoints=50 on the same program; no live
    // EarningRule. Expected fan-out: exactly one cx.nps_response rule with
    // pointsAwarded=50 (mode across the three rows).
    await seedBrand(handle, BRAND.onlySurveyIncentive, 'Brand Only Survey Incentive')
    await seedProgram(handle, 'program_1', BRAND.onlySurveyIncentive, 'Program 1')
    await seedSurvey(handle, BRAND.onlySurveyIncentive, 'program_1', 'NPS', { incentivePoints: 50 })
    await seedSurvey(handle, BRAND.onlySurveyIncentive, 'program_1', 'NPS', { incentivePoints: 50 })
    await seedSurvey(handle, BRAND.onlySurveyIncentive, 'program_1', 'NPS', { incentivePoints: 50 })

    // ---- Fixture 2: brand-only-dead-earningrule ----
    // 1 dead EarningRule(triggerEvent='survey_completion', pointsAwarded=25),
    // mix of NPS + CSAT surveys with incentivePoints=null. Expected fan-out:
    // 2 new rules (cx.nps_response + cx.csat_response, each pointsAwarded=25),
    // dead rule deleted.
    await seedBrand(handle, BRAND.onlyDeadRule, 'Brand Only Dead Rule')
    await seedProgram(handle, 'program_2', BRAND.onlyDeadRule, 'Program 2')
    await seedSurvey(handle, BRAND.onlyDeadRule, 'program_2', 'NPS', { incentivePoints: null })
    await seedSurvey(handle, BRAND.onlyDeadRule, 'program_2', 'CSAT', { incentivePoints: null })
    await seedEarningRule(handle, 'program_2', BRAND.onlyDeadRule, 'Old survey completion rule', {
      triggerEvent: 'survey_completion',
      pointsAwarded: 25,
    })

    // ---- Fixture 3: brand-both ----
    // Union of fixtures 1 and 2: an `incentivePoints` row AND a dead rule.
    // Expected: superset (1 from incentive branch + 1 from dead-rule branch
    // per cx type used). Programs are separate so we use program_3a (incentive
    // branch) and program_3b (dead-rule branch).
    await seedBrand(handle, BRAND.both, 'Brand Both')
    await seedProgram(handle, 'program_3a', BRAND.both, 'Program 3a')
    await seedSurvey(handle, BRAND.both, 'program_3a', 'CES', { incentivePoints: 75 })
    await seedSurvey(handle, BRAND.both, 'program_3a', 'CES', { incentivePoints: 75 })
    await seedProgram(handle, 'program_3b', BRAND.both, 'Program 3b')
    await seedSurvey(handle, BRAND.both, 'program_3b', 'NPS', { incentivePoints: null })
    await seedEarningRule(handle, 'program_3b', BRAND.both, 'Dead rule on 3b', {
      triggerEvent: 'survey_completion',
      pointsAwarded: 40,
    })

    // ---- Fixture 4: brand-live-cx-only ----
    // Brand has already migrated manually: a live cx.nps_response rule exists,
    // no incentivePoints on any survey, no dead rule. Expected: NO new rules
    // (the NOT EXISTS guard prevents double-writing).
    await seedBrand(handle, BRAND.liveCxOnly, 'Brand Live CX Only')
    await seedProgram(handle, 'program_4', BRAND.liveCxOnly, 'Program 4')
    await seedSurvey(handle, BRAND.liveCxOnly, 'program_4', 'NPS', { incentivePoints: null })
    await seedEarningRule(handle, 'program_4', BRAND.liveCxOnly, 'Already on cx event', {
      triggerEvent: 'cx.nps_response',
      pointsAwarded: 100,
    })

    // ---- Fixture 5: brand-neither ----
    // Nothing relevant. Expected: no migration writes for this brand.
    await seedBrand(handle, BRAND.neither, 'Brand Neither')
    await seedProgram(handle, 'program_5', BRAND.neither, 'Program 5')
    await seedSurvey(handle, BRAND.neither, 'program_5', 'NPS', { incentivePoints: null })

    // ---- Apply the target migration ----
    await handle.applyMigration(TARGET_MIGRATION)
  }, 120_000)

  afterAll(async () => {
    if (handle) await handle.teardown()
  })

  // ─── Structural assertions (post-migration schema) ───────────────────────

  it('Survey.title column exists and is nullable', async () => {
    const cols = await handle.prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = ${handle.schemaName}
        AND table_name = 'surveys'
        AND column_name = 'title'
    `
    expect(cols).toHaveLength(1)
    expect(cols[0]!.is_nullable).toBe('YES')
  })

  it('Survey.title is backfilled from Survey.name', async () => {
    // Every pre-existing seeded row had `title=null` and `name='<...>'`.
    // After migration, title MUST equal name on backfilled rows.
    const rows = await handle.prisma.$queryRaw<Array<{ name: string; title: string | null }>>`
      SELECT name, title FROM "surveys" WHERE "brandId" = ${BRAND.onlySurveyIncentive}
    `
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.title).toBe(row.name)
    }
  })

  it('Survey.incentivePoints and Survey.showIncentivePoints columns are dropped', async () => {
    const cols = await handle.prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${handle.schemaName}
        AND table_name = 'surveys'
        AND column_name IN ('incentivePoints', 'showIncentivePoints')
    `
    expect(cols).toHaveLength(0)
  })

  it('SurveyStatus enum has STOPPED and not CLOSED', async () => {
    const values = await handle.prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'SurveyStatus' AND n.nspname = ${handle.schemaName}
      ORDER BY e.enumsortorder
    `
    const labels = values.map((v) => v.enumlabel)
    expect(labels).toContain('STOPPED')
    expect(labels).not.toContain('CLOSED')
  })

  // ─── Fan-out semantics, per fixture ───────────────────────────────────────

  it('Fixture 1 (only-survey-incentive): one cx.nps_response rule with pointsAwarded=50', async () => {
    const rules = await fetchEarningRules(handle, BRAND.onlySurveyIncentive)
    // The seed planted 0 rules; migration adds exactly one.
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      programId: 'program_1',
      triggerEvent: 'cx.nps_response',
      pointsAwarded: 50,
    })
    expect(rules[0]!.name).toContain('[#241 migration]')
  })

  it('Fixture 2 (only-dead-rule): two new cx rules (NPS + CSAT), dead rule gone', async () => {
    const rules = await fetchEarningRules(handle, BRAND.onlyDeadRule)
    // Dead rule deleted; replaced by per-type fan-out for the cx types in use.
    expect(rules).toHaveLength(2)
    const triggers = rules.map((r) => r.triggerEvent).sort()
    expect(triggers).toEqual(['cx.csat_response', 'cx.nps_response'])
    for (const r of rules) {
      expect(r.pointsAwarded).toBe(25)
      expect(r.name).toContain('[#241 migration]')
    }
    // Confirm the dead rule is gone.
    const dead = rules.filter((r) => r.triggerEvent === 'survey_completion')
    expect(dead).toHaveLength(0)
  })

  it('Fixture 3 (both): incentive branch + dead-rule branch produce a superset', async () => {
    const rules = await fetchEarningRules(handle, BRAND.both)
    // program_3a: 2 CES surveys with incentivePoints=75 → 1 cx.ces_response rule (mode=75).
    // program_3b: dead rule fanned out over NPS (1 survey) → 1 cx.nps_response rule (pointsAwarded=40).
    expect(rules).toHaveLength(2)

    const cesRule = rules.find((r) => r.triggerEvent === 'cx.ces_response')
    expect(cesRule).toBeDefined()
    expect(cesRule!).toMatchObject({ programId: 'program_3a', pointsAwarded: 75 })

    const npsRule = rules.find((r) => r.triggerEvent === 'cx.nps_response')
    expect(npsRule).toBeDefined()
    expect(npsRule!).toMatchObject({ programId: 'program_3b', pointsAwarded: 40 })

    // No `survey_completion` rule survives.
    expect(rules.find((r) => r.triggerEvent === 'survey_completion')).toBeUndefined()
  })

  it('Fixture 4 (live-cx-only): no new rules — NOT EXISTS guard fires', async () => {
    const rules = await fetchEarningRules(handle, BRAND.liveCxOnly)
    // Only the pre-existing rule. No migration-tagged rules.
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      triggerEvent: 'cx.nps_response',
      pointsAwarded: 100,
    })
    // The pre-existing rule keeps its original name (no migration tag).
    expect(rules[0]!.name).not.toContain('[#241 migration]')
  })

  it('Fixture 5 (neither): no migration writes for this brand', async () => {
    const rules = await fetchEarningRules(handle, BRAND.neither)
    expect(rules).toHaveLength(0)
  })
})

// ─── Seed helpers (raw SQL — bypass typed client) ──────────────────────────

async function seedBrand(handle: MigrationTestDbHandle, id: string, name: string): Promise<void> {
  await handle.prisma.$executeRawUnsafe(
    `INSERT INTO "brands" (id, "clerkOrgId", name, "memberIdentifierKind", "consentMode", timezone, locale, "createdAt")
     VALUES ($1, $2, $3, 'EMAIL', 'EXPLICIT', 'UTC', 'en-US', NOW())`,
    id,
    `clerk_${id}`,
    name,
  )
}

async function seedProgram(
  handle: MigrationTestDbHandle,
  id: string,
  brandId: string,
  name: string,
): Promise<void> {
  await handle.prisma.$executeRawUnsafe(
    `INSERT INTO "programs" (id, "brandId", name, "pointCurrencyName", "pointToCurrencyRatio", status, type, "budgetSpentCents", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'Points', 0.01, 'ACTIVE', 'POINTS', 0, NOW(), NOW())`,
    id,
    brandId,
    name,
  )
}

async function seedSurvey(
  handle: MigrationTestDbHandle,
  brandId: string,
  programId: string,
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM',
  opts: { incentivePoints: number | null },
): Promise<void> {
  const id = `srv_${brandId}_${programId}_${type}_${Math.random().toString(36).slice(2, 8)}`
  await handle.prisma.$executeRawUnsafe(
    `INSERT INTO "surveys"
       (id, "brandId", "programId", name, type, questions, status, "responsesCount", "distributionCount",
        "incentivePoints", "responsePolicy", "thankYouMessage", "showIncentivePoints",
        "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::"SurveyType", '[]'::jsonb, 'DRAFT', 0, 0,
             $6, 'MULTIPLE', 'Thank you for your feedback!', TRUE,
             NOW(), NOW())`,
    id,
    brandId,
    programId,
    `Survey ${id}`,
    type,
    opts.incentivePoints,
  )
}

async function seedEarningRule(
  handle: MigrationTestDbHandle,
  programId: string,
  brandId: string,
  name: string,
  opts: { triggerEvent: string; pointsAwarded: number },
): Promise<void> {
  const id = `er_${programId}_${brandId}_${Math.random().toString(36).slice(2, 8)}`
  await handle.prisma.$executeRawUnsafe(
    `INSERT INTO "earning_rules"
       (id, "programId", "brandId", name, "triggerEvent", "pointsAwarded",
        multiplier, status, priority, stackable, "budgetUsedPoints", "validFrom", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, 1.0, 'ACTIVE', 0, FALSE, 0, NOW(), NOW())`,
    id,
    programId,
    brandId,
    name,
    opts.triggerEvent,
    opts.pointsAwarded,
  )
}

interface EarningRuleRow {
  id: string
  programId: string
  brandId: string
  name: string
  triggerEvent: string
  pointsAwarded: number
}

async function fetchEarningRules(
  handle: MigrationTestDbHandle,
  brandId: string,
): Promise<EarningRuleRow[]> {
  return handle.prisma.$queryRaw<EarningRuleRow[]>`
    SELECT id, "programId", "brandId", name, "triggerEvent", "pointsAwarded"
    FROM "earning_rules"
    WHERE "brandId" = ${brandId}
    ORDER BY "triggerEvent" ASC
  `
}
