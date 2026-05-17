/// <reference types="vitest" />
// Issue #405 — Backfill script integration test.
//
// Asserts the script's pure `runBackfill(prisma, options)` function:
//   - Seeds 4 defaults + Indigo defaultThemeId for brands with zero themes.
//   - Leaves brands with ≥1 theme entirely untouched (idempotency).
//   - `--dry-run` performs no writes.
//
// Uses the real test DB via getTestPrisma(); the script imports
// PrismaClient lazily inside main() so importing the module here for tests
// doesn't open a second connection.

import { describe, it, expect } from 'vitest'
import { getTestPrisma } from '@customerEQ/config/test-utils'
import { runBackfill } from '../../../../scripts/backfill-brand-default-themes.js'

describe('backfill-brand-default-themes — runBackfill (Issue #405)', () => {
  it('seeds 4 default themes + Indigo defaultThemeId for a brand with zero themes', async () => {
    const prisma = getTestPrisma()
    const clerkOrgId = `org_405_bf_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const themeless = await prisma.brand.create({
      data: { clerkOrgId, name: 'Themeless Backfill Target' },
      select: { id: true },
    })

    const result = await runBackfill(prisma, { dryRun: false })

    // The result includes this brand among backfilled rows.
    const myRow = result.backfilled.find((r) => r.brandId === themeless.id)
    expect(myRow, 'backfill did not include the themeless brand').toBeDefined()
    expect(myRow!.themesSeeded).toBe(4)

    const themes = await prisma.brandTheme.findMany({
      where: { brandId: themeless.id },
      select: { name: true, id: true },
      orderBy: { name: 'asc' },
    })
    expect(themes.map((t) => t.name)).toEqual(['Forest', 'Indigo', 'Slate', 'Sunset'])

    const after = await prisma.brand.findUniqueOrThrow({
      where: { id: themeless.id },
      select: { defaultThemeId: true },
    })
    const indigo = themes.find((t) => t.name === 'Indigo')
    expect(after.defaultThemeId).toBe(indigo!.id)
  })

  it('skips brands that already have at least one theme (idempotency)', async () => {
    const prisma = getTestPrisma()
    const clerkOrgId = `org_405_bf_skip_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const partial = await prisma.brand.create({
      data: {
        clerkOrgId,
        name: 'Partial Backfill Skip',
        brandThemes: {
          createMany: {
            data: [
              {
                name: 'Custom',
                primaryColor: '#000000',
                secondaryColor: '#111111',
                backgroundColor: '#ffffff',
                textColor: '#000000',
                buttonColor: '#000000',
                buttonTextColor: '#ffffff',
                accentColor: '#222222',
              },
            ],
          },
        },
      },
      select: { id: true },
    })

    const result = await runBackfill(prisma, { dryRun: false })

    // This brand should NOT appear in the backfilled list.
    expect(result.backfilled.find((r) => r.brandId === partial.id)).toBeUndefined()

    // Theme count remains exactly 1 — the script did not insert defaults.
    const themes = await prisma.brandTheme.findMany({
      where: { brandId: partial.id },
      select: { name: true },
    })
    expect(themes).toHaveLength(1)
    expect(themes[0].name).toBe('Custom')
  })

  it('--dry-run reports the brand but performs no writes', async () => {
    const prisma = getTestPrisma()
    const clerkOrgId = `org_405_bf_dry_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const themeless = await prisma.brand.create({
      data: { clerkOrgId, name: 'Dry-run Target' },
      select: { id: true },
    })

    const result = await runBackfill(prisma, { dryRun: true })

    const myRow = result.backfilled.find((r) => r.brandId === themeless.id)
    expect(myRow, 'dry-run should still report the brand').toBeDefined()
    expect(myRow!.themesSeeded).toBe(4)
    // defaultThemeId is null in dry-run because no Indigo row was inserted.
    expect(myRow!.defaultThemeId).toBeNull()

    const themes = await prisma.brandTheme.count({ where: { brandId: themeless.id } })
    expect(themes).toBe(0)

    const after = await prisma.brand.findUniqueOrThrow({
      where: { id: themeless.id },
      select: { defaultThemeId: true },
    })
    expect(after.defaultThemeId).toBeNull()
  })
})
