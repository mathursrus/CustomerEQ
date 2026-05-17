/**
 * Issue #405 — Backfill default themes for brands stuck with zero BrandTheme
 * rows.
 *
 * Affected brands are those created before [PR #307 / commit `c2c55b1`](
 * https://github.com/mathursrus/CustomerEQ/commit/c2c55b1) added the lazy-
 * upsert's default-theme seeding logic. Their rows were inserted manually or
 * by a code path that didn't seed; the lazy-upsert's `update: {}` branch
 * never re-evaluates whether themes exist, so they sit permanently with
 * `themes = []` and `defaultThemeId = NULL`. The `LookFeelTab` survey-editor
 * preview short-circuits in that state, producing an empty tab.
 *
 * This is a one-off backfill. The lazy-upsert in
 * `apps/api/src/routes/admin-brand-profile.ts` was extended in the same
 * PR (#405) to self-heal on every GET, so any brand affected after this
 * script runs will fix itself on next admin visit. The script remains
 * useful as a defensive sweep against future regressions.
 *
 * Behavior:
 *   - Lists every Brand with zero BrandTheme rows.
 *   - For each: insert the 4 defaults (Indigo, Forest, Sunset, Slate) and
 *     point `Brand.defaultThemeId` at the new Indigo row.
 *   - Idempotent — brands with ≥1 BrandTheme are skipped entirely (the
 *     script never modifies existing themes or an already-set defaultThemeId).
 *
 * Usage:
 *   pnpm backfill:brand-default-themes              # apply
 *   pnpm backfill:brand-default-themes --dry-run    # report only, no writes
 */

// PrismaClient is loaded lazily inside main() via `createRequire` so that
// (a) test files importing `runBackfill` from this module don't trigger a
// production prisma client construction — they pass their own
// `getTestPrisma()` — and (b) Node ESM's strict package-resolution
// (which can't find `@prisma/client` from this script's location since
// the root package.json doesn't declare it as a dep) is bypassed via
// CJS-style resolution that walks up the node_modules chain.
import type { PrismaClient } from '@prisma/client'
import { DEFAULT_THEMES } from '../apps/api/src/lib/default-themes.js'

const DRY_RUN = process.argv.includes('--dry-run')

interface BackfillResult {
  brandId: string
  brandName: string
  themesSeeded: number
  defaultThemeId: string | null
}

export async function runBackfill(
  prisma: Pick<PrismaClient, 'brand' | 'brandTheme'>,
  options: { dryRun: boolean } = { dryRun: false },
): Promise<{ scanned: number; backfilled: BackfillResult[]; skipped: number }> {
  // Find every Brand whose related BrandTheme count is zero. Prisma can't
  // express a HAVING COUNT(*) = 0 directly on findMany; we fetch the
  // candidate set via `where: { brandThemes: { none: {} } }`.
  const themeless = await prisma.brand.findMany({
    where: { brandThemes: { none: {} } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  const total = await prisma.brand.count()
  const skipped = total - themeless.length

  const backfilled: BackfillResult[] = []

  for (const b of themeless) {
    if (options.dryRun) {
      backfilled.push({
        brandId: b.id,
        brandName: b.name,
        themesSeeded: DEFAULT_THEMES.length,
        defaultThemeId: null,
      })
      continue
    }

    await prisma.brandTheme.createMany({
      data: DEFAULT_THEMES.map((t) => ({ ...t, brandId: b.id })),
    })
    const indigo = await prisma.brandTheme.findFirst({
      where: { brandId: b.id, name: 'Indigo' },
      select: { id: true },
    })
    if (indigo) {
      await prisma.brand.update({
        where: { id: b.id },
        data: { defaultThemeId: indigo.id },
      })
    }
    backfilled.push({
      brandId: b.id,
      brandName: b.name,
      themesSeeded: DEFAULT_THEMES.length,
      defaultThemeId: indigo?.id ?? null,
    })
  }

  return { scanned: total, backfilled, skipped }
}

async function main() {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const { PrismaClient: ClientCtor } =
    require('@prisma/client') as typeof import('@prisma/client')
  const db = new ClientCtor()

  console.log(
    `\n🎨 Backfill brand default themes ${DRY_RUN ? '(DRY RUN — no writes)' : '(applying changes)'}\n`,
  )

  try {
    const { scanned, backfilled, skipped } = await runBackfill(db, { dryRun: DRY_RUN })

    if (backfilled.length === 0) {
      console.log(
        `✓ Scanned ${scanned} brand${scanned === 1 ? '' : 's'} — all already have at least one theme. Nothing to do.`,
      )
      return
    }

    console.log(
      `Found ${backfilled.length} brand${backfilled.length === 1 ? '' : 's'} with zero themes (of ${scanned} total; ${skipped} skipped):\n`,
    )
    for (const r of backfilled) {
      const tag = DRY_RUN ? '[dry-run]' : '✓'
      const defaultNote = r.defaultThemeId
        ? `defaultThemeId set to Indigo (${r.defaultThemeId})`
        : DRY_RUN
          ? 'defaultThemeId would be set to Indigo'
          : 'defaultThemeId NOT set (Indigo not found after seed — inspect)'
      console.log(`  ${tag} ${r.brandName} (${r.brandId}) — seeded ${r.themesSeeded} themes; ${defaultNote}`)
    }

    if (DRY_RUN) {
      console.log(
        `\nDry-run complete. Re-run without --dry-run to apply.`,
      )
    } else {
      console.log(`\n✓ Backfill complete.`)
    }
  } finally {
    await db.$disconnect()
  }
}

// Only execute when run directly (`tsx scripts/backfill-…`), not when a
// test file imports `runBackfill`. Vitest sets `process.env.VITEST=true`
// during test runs, so we can reliably skip the CLI side effects there.
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}
