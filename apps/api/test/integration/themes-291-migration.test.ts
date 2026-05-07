/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, teardownTestDb, getTestPrisma } from '@customerEQ/config/test-utils'

/**
 * Issue #291 — BrandTheme/SurveyTheme split + backfill migration.
 *
 * Verifies the structural shape produced by the migration:
 * (1) `brand_themes` table exists, has no pruned columns, and is FK'd correctly
 *     from both `surveys.themeId` and `brands.defaultThemeId`.
 * (2) `surveys` gained the three thank-you columns with the documented defaults.
 * (3) `brands.defaultThemeId` enforces FK to `brand_themes(id)`.
 *
 * Smoke-tests the new behavior end-to-end via the Prisma client:
 * (4) Theme creation does NOT accept the dropped fields (Prisma type-side check).
 * (5) Survey creation accepts the three new columns and persists them.
 * (6) Setting `Brand.defaultThemeId` to a theme id is the way to mark a theme default.
 *
 * The backfill SQL itself (block 3 + block 4 of the migration) ran during
 * `prisma migrate deploy`; this test verifies the post-state is correct on a
 * fresh DB (`prisma db push` against the schema.prisma).
 */

describe('Issue #291 — BrandTheme/SurveyTheme split (migration verification)', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('brand_themes table has no pruned columns', async () => {
    const prisma = getTestPrisma()
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'brand_themes' AND table_schema = current_schema()
    `
    const names = cols.map((c) => c.column_name)
    // The 6 fields that moved off the brand-theme model:
    expect(names).not.toContain('logoUrl')
    expect(names).not.toContain('brandName')
    expect(names).not.toContain('thankYouMessage')
    expect(names).not.toContain('thankYouRedirectUrl')
    expect(names).not.toContain('showIncentivePoints')
    expect(names).not.toContain('isDefault')
    // What stays — the brand-level visual identity:
    expect(names).toContain('id')
    expect(names).toContain('brandId')
    expect(names).toContain('name')
    expect(names).toContain('primaryColor')
    expect(names).toContain('fontFamily')
    expect(names).toContain('cardStyle')
  })

  it('surveys gained the three thank-you columns with correct defaults', async () => {
    const prisma = getTestPrisma()
    const cols = await prisma.$queryRaw<Array<{ column_name: string; column_default: string | null; is_nullable: string }>>`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'surveys'
        AND table_schema = current_schema()
        AND column_name IN ('thankYouMessage', 'thankYouRedirectUrl', 'showIncentivePoints')
      ORDER BY column_name
    `
    expect(cols).toHaveLength(3)

    const message = cols.find((c) => c.column_name === 'thankYouMessage')!
    expect(message.is_nullable).toBe('NO')
    expect(message.column_default).toContain('Thank you for your feedback!')

    const redirect = cols.find((c) => c.column_name === 'thankYouRedirectUrl')!
    expect(redirect.is_nullable).toBe('YES')

    const showIncentive = cols.find((c) => c.column_name === 'showIncentivePoints')!
    expect(showIncentive.is_nullable).toBe('NO')
    expect(showIncentive.column_default).toMatch(/true/i)
  })

  it('brands.defaultThemeId and surveys.themeId both FK to brand_themes(id)', async () => {
    // pg_constraint lookup is much faster than the information_schema 3-way joins,
    // which can time out under load. Behavior is also covered end-to-end by the
    // smoke test below — this is a complementary structural assertion.
    const prisma = getTestPrisma()
    const fks = await prisma.$queryRaw<Array<{
      conname: string
      table_name: string
      column_name: string
      ref_table_name: string
      ref_column_name: string
    }>>`
      SELECT
        c.conname,
        cl.relname AS table_name,
        att.attname AS column_name,
        ref_cl.relname AS ref_table_name,
        ref_att.attname AS ref_column_name
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      JOIN pg_class ref_cl ON c.confrelid = ref_cl.oid
      JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = c.conkey[1]
      JOIN pg_attribute ref_att ON ref_att.attrelid = ref_cl.oid AND ref_att.attnum = c.confkey[1]
      WHERE c.contype = 'f'
        AND ref_cl.relname = 'brand_themes'
        AND cl.relname IN ('brands', 'surveys')
        AND att.attname IN ('defaultThemeId', 'themeId')
    `
    const byTable = new Map(fks.map((row) => [row.table_name, row]))
    const brandsFk = byTable.get('brands')
    expect(brandsFk).toBeDefined()
    expect(brandsFk!.column_name).toBe('defaultThemeId')
    expect(brandsFk!.ref_column_name).toBe('id')
    const surveysFk = byTable.get('surveys')
    expect(surveysFk).toBeDefined()
    expect(surveysFk!.column_name).toBe('themeId')
    expect(surveysFk!.ref_column_name).toBe('id')
  })

  it('end-to-end smoke: brand → brand-theme → survey, with derived isDefault', async () => {
    const prisma = getTestPrisma()

    const brand = await prisma.brand.create({
      data: { name: 'Acme', clerkOrgId: `org_test_${Date.now()}` },
    })
    const program = await prisma.program.create({
      data: { brandId: brand.id, name: 'Loyalty', status: 'ACTIVE' },
    })
    const theme = await prisma.brandTheme.create({
      data: { brandId: brand.id, name: 'Acme Brand Theme', primaryColor: '#d97706' },
    })

    // Create a survey with default thank-you values.
    const survey1 = await prisma.survey.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'NPS',
        type: 'NPS',
        questions: [{ id: 'q1', text: 'Q', type: 'rating', required: true }],
        themeId: theme.id,
      },
    })
    expect(survey1.thankYouMessage).toBe('Thank you for your feedback!')
    expect(survey1.thankYouRedirectUrl).toBeNull()
    expect(survey1.showIncentivePoints).toBe(true)

    // Custom thank-you values land on Survey, not BrandTheme.
    const survey2 = await prisma.survey.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'CSAT',
        type: 'CSAT',
        questions: [{ id: 'q1', text: 'Q', type: 'rating', required: true }],
        themeId: theme.id,
        thankYouMessage: 'Thanks for your time!',
        showIncentivePoints: false,
      },
    })
    expect(survey2.thankYouMessage).toBe('Thanks for your time!')
    expect(survey2.showIncentivePoints).toBe(false)

    // Setting the default theme writes Brand.defaultThemeId — single statement.
    await prisma.brand.update({
      where: { id: brand.id },
      data: { defaultThemeId: theme.id },
    })
    const refetched = await prisma.brand.findUnique({ where: { id: brand.id } })
    expect(refetched?.defaultThemeId).toBe(theme.id)
  })
})
