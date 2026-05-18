# Implementation Evidence — Issue #405

**Issue**: #405 — [P0] Survey Look & Feel preview empty — Brand rows created by Clerk webhook never get default themes
**Branch**: `feature/405-p0-survey-look-feel-preview-empty-brand-rows-created-by-clerk-webhook-never-get-default-themes`
**Author**: Claude (Opus 4.7), session 2026-05-17

---

## Phase-by-phase log

### Phase 1 — implement-scoping

Work-list at `docs/evidence/405-implement-work-list.md`. Two passes:

1. Initial pass scoped webhook seeding + backfill + UI as #405.
2. Phase-2 investigation revealed the webhook 500s in prod due to a nested-`$transaction` bug (`emitActivationStep(tx as never, …)`) and is dead-code today. Real prod brands provision via the lazy-upsert in `admin-brand-profile.ts` (added by PR #307), which seeds themes correctly. Pre-#307 brands (e.g. ArtistOS) sit permanently themeless because `update: {}` never re-seeds. **Scope corrected**: webhook fix moved to #239 (retitled, scope expanded, #250/#251/#266 rolled in). #405 narrows to (1) backfill script, (2) self-heal at lazy-upsert, (3a/3b) UI empty states, (5) Org Settings action-needed rows.

### Phase 2 — implement-repro

Failing integration test at `apps/api/test/integration/admin-brand-profile.test.ts` → *"self-heals a pre-existing brand with zero themes — seeds 4 defaults + Indigo defaultThemeId (Issue #405)"*. Pre-existing brand with zero themes → GET `/v1/admin/brand/profile` → assertion that themes are now `[Forest, Indigo, Slate, Sunset]` and `defaultThemeId = Indigo.id`. **Confirmed RED**: received `[]` after GET, before any fix.

Companion gated test: *"does not re-seed when a pre-existing brand already has at least one theme"* — **PASSES**, proving the self-heal block must not clobber operator-added themes.

### Phase 3 — implement-tests

| Test | File | Initial state |
|---|---|---|
| LookFeelTab empty-state message renders | `LookFeelTab.test.tsx` | RED |
| LookFeelTab contact-admin copy, no outbound link | `LookFeelTab.test.tsx` | RED |
| LookFeelTab does NOT render preview panes when themes=[] | `LookFeelTab.test.tsx` | RED |
| LookFeelTab still renders chrome matrix when themes=[] | `LookFeelTab.test.tsx` | GREEN (gated) |
| pendingItems — themes-empty row emitted | `pendingItems.test.ts` | RED |
| pendingItems — default-theme-not-set row emitted | `pendingItems.test.ts` | RED |
| pendingItems — themes row subsumes default when count is zero | `pendingItems.test.ts` | RED |
| pendingItems — regression for existing rows (Slice 4 baseline) | `pendingItems.test.ts` | GREEN |
| pendingItems — no rows when fully configured | `pendingItems.test.ts` | GREEN (gated) |
| pendingItems — server state (not form values) drives themes rows | `pendingItems.test.ts` | GREEN (gated) |
| Backfill script — seeds 4 defaults + Indigo for zero-theme brand | `backfill-brand-default-themes.test.ts` | (Phase 4: paired with script) |
| Backfill script — skips brands with ≥1 theme | `backfill-brand-default-themes.test.ts` | (Phase 4) |
| Backfill script — `--dry-run` performs no writes | `backfill-brand-default-themes.test.ts` | (Phase 4) |

### Phase 4 — implement-code

**Point 2 — Self-heal at lazy-upsert** (`apps/api/src/routes/admin-brand-profile.ts`):
Added a check after the upsert returns, before the existing Promise.all that fetches brand+themes+memberCount: if `BrandTheme.count = 0`, seed the 4 defaults via `createMany` + set `Brand.defaultThemeId` to the new Indigo row. Mirrors the create-branch payload. Idempotent (skipped when ≥1 theme exists).

**Point 1 — Backfill script** (`scripts/backfill-brand-default-themes.ts`):
Standalone `tsx` script. Exposes `runBackfill(prisma, { dryRun })` for testing; CLI entrypoint when invoked directly. Adds `pnpm backfill:brand-default-themes` to root `package.json`. Imports `DEFAULT_THEMES` from `apps/api/src/lib/default-themes.ts` so seed data has one source of truth.

**Point 3a — LookFeelTab empty state** (RBAC-neutral):
When `themes.length === 0`, renders an amber panel with `data-testid="themes-empty-state"`. Copy: *"No themes are configured for this brand yet. Survey previews can't render until at least one theme exists for the brand. Contact a brand administrator to set one up."* No outbound link — future RBAC may not grant the viewer access to `/admin/settings/organization`. Chrome matrix (theme-independent) still renders.

**Point 3b — LookAndFeelSection empty state** (admin-only, prescriptive):
Replaced stale *"refresh after the API seeds defaults"* (false — nothing async will seed) with *"No themes are configured for this brand yet. Use Settings → Themes to add the first one."* Keeps the existing "Open Themes →" link in the surrounding banner.

**Point 5 — pendingItems extension + form wiring**:
- `lib/types.ts` — widened `PendingItem.field` to `keyof OrgFormValues | 'themes' | 'defaultTheme'` and added `PendingItemContext { themesCount; hasDefaultTheme }`.
- `lib/pendingItems.ts` — `computePendingItems(values, context)` emits a *"Themes"* row when `themesCount === 0` and a *"Default theme"* row when `themesCount > 0 && !hasDefaultTheme`. Both `jumpToSectionId: 's-lookfeel'`. Both use server-loaded state, not form values, so in-flight edits don't flicker the banner.
- `components/OrganizationSettingsForm.tsx` — passes `{ themesCount: initial.themes.length, hasDefaultTheme: Boolean(initial.brand.defaultThemeId) }` into `computePendingItems`.

**Points 6 + 7 — Public renderer three-tier theme fallback (scope expansion per user 2026-05-17)**:
- `apps/api/src/routes/public.ts` — added `defaultTheme: true` to the brand select on `GET /v1/public/surveys/:id`; computed `resolvedTheme = survey.theme ?? brand.defaultTheme ?? FALLBACK_RESPONDENT_THEME` and returned a stripped `brand` object (no `defaultTheme` leak) + the resolved `theme`. Fallback constant uses `DEFAULT_THEMES[0]` + Prisma BrandTheme typography defaults; sentinel id `__customereq_default_indigo__` makes the fallback origin obvious in logs / analytics.
- `apps/web/src/app/survey/[id]/page.tsx` — removed the 16-line hardcoded `DEFAULT_THEME` constant, tightened `theme: BrandThemeLite` (no longer nullable), moved `const themeForRender = survey.theme` below the existing `!resolvedSurvey || !brandLite || !survey` early-return so TypeScript narrows correctly.
- Net effect: single source of truth for the canonical CustomerEQ Indigo across new-brand seeding (lazy-upsert), webhook (when #239 lands), backfill script, AND respondent fallback. ArtistOS-style brands no longer silently render unbranded surveys to their customers.

**Scope-expansion note (non-precedent)**: points 6 + 7 violate the standing P-HIGH "Tight PR scope" coaching. Per user 2026-05-17: explicit override because production customers including ArtistOS are not live with respondent surveys yet, so customer-impact framing that normally forces tight scoping doesn't apply. User noted *"This scope expansion should NOT be taken as precedent."*

### Phase 5 — implement-validate

| Gate | Result | Notes |
|---|---|---|
| `pnpm --filter @customerEQ/web --filter @customerEQ/api typecheck` | ✅ Pass | Both packages, zero errors |
| `pnpm --filter @customerEQ/web --filter @customerEQ/api lint` | ✅ Pass | 0 errors, 10 pre-existing warnings (none in touched files) |
| `pnpm --filter @customerEQ/api test` (smoke / unit) | ✅ Pass | 460/460 |
| `pnpm --filter @customerEQ/web test -- LookFeelTab.test pendingItems.test` | ✅ Pass | 23/23 |
| `pnpm --filter @customerEQ/api test:integration` (admin-brand-profile + backfill + public-survey) | ✅ Pass | 27/27 + 3/3 + 29/29 — three #405 self-heal tests + three #405 backfill tests + three #405 tier-1/2/3 fallback tests all green |
| `pnpm --filter @customerEQ/web --filter @customerEQ/api build` (full, lint-as-error fires here) | ✅ Pass | Both `next build` and api `tsc` complete; no `@typescript-eslint/no-unused-vars` regressions |
| `pnpm backfill:brand-default-themes --dry-run` (CLI smoke against dev DB) | ✅ Pass | Identified 1 of 4 dev brands as themeless |
| Real-DB self-heal smoke (manual) | ✅ Pass | Wiped all dev-brand themes via SQL, hit `/v1/admin/brand/profile`, observed the resolved brand transition 0 → 4 themes + Indigo defaultThemeId atomically with a single GET |
| Real-DB backfill smoke (manual) | ✅ Pass | `pnpm backfill:brand-default-themes` (no flag) seeded all 3 remaining themeless dev brands; verified via SQL |
| Manual browser walk | ✅ Confirmed by user (2026-05-17) | Issue #405 author signed off after visiting `/admin/surveys/<id>/edit?tab=look-feel` against the dev server post-backfill |

### Phase 6 — implement-security-review

(To be appended after Phase 5 completes.)

### Phase 7 — implement-regression

(Full suite re-run; capture results.)

---

## Out-of-scope work tracked elsewhere

- **#239** — Webhook auto-provision + nested-tx fix + default Engagement Program + `/api/auth/signup*` retirement + dev-secret base64 + Fastify-5 startup verify. Closes #250, #266, #251. Tracking comment: <https://github.com/mathursrus/CustomerEQ/issues/239#issuecomment-4470329561>.
