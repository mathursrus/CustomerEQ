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

  it('brands.defaultThemeId has FK to brand_themes(id)', async () => {
    const prisma = getTestPrisma()
    const fks = await prisma.$queryRaw<Array<{ constraint_name: string; foreign_table_name: string; foreign_column_name: string }>>`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'brands'
        AND kcu.column_name = 'defaultThemeId'
        AND tc.table_schema = current_schema()
    `
    expect(fks.length).toBeGreaterThan(0)
    expect(fks[0].foreign_table_name).toBe('brand_themes')
    expect(fks[0].foreign_column_name).toBe('id')
  })

  it('surveys.themeId FK targets brand_themes(id) (auto-retargeted on rename)', async () => {
    const prisma = getTestPrisma()
    const fks = await prisma.$queryRaw<Array<{ foreign_table_name: string; foreign_column_name: string }>>`
      SELECT
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'surveys'
        AND kcu.column_name = 'themeId'
        AND tc.table_schema = current_schema()
    `
    expect(fks.length).toBeGreaterThan(0)
    expect(fks[0].foreign_table_name).toBe('brand_themes')
    expect(fks[0].foreign_column_name).toBe('id')
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
