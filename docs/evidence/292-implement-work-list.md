# Implementation Work List — Issue #292 Slice 1 (Schema migration)

**FRAIM session**: `7b2f6724-96ef-4bd4-926a-fccede38fda8`
**Job**: `feature-implementation`
**Branch**: `feature/issue-292-org-settings-schema`
**Issue type**: feature
**Slice**: 1 of 4 (schema migration only — `~30 LOC`)

## Source-of-truth references

- Issue: [#292](https://github.com/mathursrus/CustomerEQ/issues/292) — umbrella implementation issue
- Source spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md) §"Field inventory" + §"Schema migrations in #277 scope"
- RFC: [`docs/rfcs/277-organization-settings.md`](../rfcs/277-organization-settings.md) §1 (Schema changes), §2 (Schema migration)
- Architecture: [`docs/architecture/architecture.md`](../architecture/architecture.md) §3.2 API Layer (multi-tenant `brandId`), §6 Patterns (forward-only migrations)
- Project rules: R10 (branch ↔ issue), R21 (one issue per branch), R11 (validation commands), R11a (tests fail loudly)

## Slice 1 scope (from RFC §1, §2; spec L158)

Single Prisma migration touching only the `brands` table. Four discrete changes:

1. Rename column `Brand.sizeCategory` → `Brand.orgSize` (no data change).
2. Reshape `OrgSizeCategory` enum: drop superseded values `SIZE_51_200`, `SIZE_201_PLUS`; keep canonical six (`SIZE_1_10`, `SIZE_11_50`, `SIZE_51_300`, `SIZE_301_5000`, `SIZE_5000_PLUS`, `PREFER_NOT_TO_SAY`). Postgres lacks `ALTER TYPE … DROP VALUE`; uses the cast-to-TEXT-and-recreate pattern.
3. Add `Brand.timezone String @default("UTC")` — IANA tz; non-null with default for safe backfill.
4. Add `Brand.locale String @default("en-US")` — BCP 47; non-null with default for safe backfill.

## Implementation checklist

### Files touched (target: 2)

- [ ] `packages/database/prisma/schema.prisma` — model `Brand` field rename + 2 new fields; enum `OrgSizeCategory` reshape (≈8 lines).
- [ ] `packages/database/prisma/migrations/20260507120000_org_settings_277/migration.sql` — new migration file matching RFC §2 SQL.

### Out-of-scope for this slice (deferred to later slices / sibling issues)

- ❌ `@customereq/consent-text` shared package (Slice 2).
- ❌ `apps/api/src/routes/admin-brand-profile.ts` and audit-plugin allowlist (Slice 3).
- ❌ `/admin/settings/organization` page and `AdminPendingBanner` (Slice 4).
- ❌ `survey_themes.isStockDefault` / theme-seed work (already shipped under [#291](https://github.com/mathursrus/CustomerEQ/issues/291) which renamed `survey_themes` → `brand_themes` and added the `Brand.defaultThemeId` FK).
- ❌ Architecture-doc updates (already landed in PR #290 RFC commit).
- ❌ Renaming TS consumers of `sizeCategory` — verified by `grep`: zero TS consumers reference the old field name (only docs + the original `20260427000000_onboarding_first_run` migration, both unaffected).

## Pattern Discovery

### Environment patterns
None added or consumed by Slice 1 (no env vars, no config keys, no constants).

### Constants inventory
- `OrgSizeCategory` enum is the only constant changed; reshape per RFC §1.
- No utility/constants files touched.

### Architectural patterns followed
- **Forward-only migrations** (architecture §6) — no `DOWN` SQL emitted; `_prisma_migrations` enforces idempotency.
- **`IF NOT EXISTS`-guarded column adds** (#276 RFC pattern) — applied to `timezone` / `locale` per RFC §2.
- **Enum-recreate pattern** (Postgres-standard cast-to-TEXT-and-recreate) — same shape used by prior migrations dealing with enum mutations.
- **Hand-edited migration with block-ordering comments** — per [`packages/database/prisma/migrations/20260507083000_brandtheme_surveytheme_split/migration.sql`](../../packages/database/prisma/migrations/20260507083000_brandtheme_surveytheme_split/migration.sql) precedent. Prisma's auto-gen would emit DROP+CREATE on rename; hand-edited preserves data.

### Migration naming
- Convention: `YYYYMMDDHHMMSS_<lowercase_underscored_slug>` (Prisma standard).
- Last migration: `20260507083000_brandtheme_surveytheme_split` (today, earlier).
- This migration: `20260507120000_org_settings_277` (today, after the BrandTheme split).

## Validation Requirements

| Mode | Required for Slice 1? | Notes |
|---|---|---|
| `pnpm prisma generate` | **Yes** | Regenerates the typed Prisma Client; build will fail without it because the renamed field is consumed downstream in later slices. |
| `pnpm prisma validate` | **Yes** | Static schema validation. |
| **`pnpm prisma migrate dev` against Docker-backed DB** | **Yes — load-bearing** | P-MED L1 mistake-pattern from #170 PR1 (2026-04-27): "Migration not validated against a real DB before PR submission" — `migrate dev` against the shadow DB is the only thing that catches drift. **Pre-submission gate.** Captures real failure of: enum recreate, USING-cast, IF NOT EXISTS guards, FK chain (post-#291). |
| `pnpm build` | **Yes** | Per project rule R11. |
| `pnpm typecheck` | **Yes** | Per project rule R11. |
| `pnpm lint` | **Yes** | Per project rule R11. |
| `pnpm test:smoke` | **Yes** | Per project rule R11. |
| `pnpm test:integration` | **No (out of scope for Slice 1)** | Slice 3 (`apps/api/src/routes/admin-brand-profile.ts`) is the home for integration tests; the migration is exercised transitively when Slice 3's tests run, but Slice 1 ships no test files of its own. |
| Browser / `pnpm test:e2e` | **No (no UI delta)** | Slice 4 ships UI; Slice 1 has no UI surface. `uiValidationRequired = false` for this slice. |
| `mobileValidationRequired` | **No** | No UI delta. |

## Pre-submission checkboxes (this PR)

- [ ] Schema delta matches RFC §1 line-by-line (rename + 6 enum values + 2 new fields with defaults).
- [ ] Migration SQL matches RFC §2 verbatim, with comment block documenting RFC source.
- [ ] `pnpm prisma generate` succeeds.
- [ ] `pnpm prisma validate` succeeds.
- [ ] `pnpm prisma migrate dev` succeeds against Docker-backed DB; output captured in evidence.
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke` all pass at repo root.
- [ ] `git status` shows only `packages/database/prisma/schema.prisma` + new migration directory + this work-list staged. No `package-lock.json` pollution (P-MED 4-recurrence pattern from `prep-issue.sh`).
- [ ] No `survey_themes`/`isStockDefault`/`@@unique([brandId, name])` work leaked from #291's deferred-scope.
- [ ] Branch is `feature/issue-292-org-settings-schema` (already verified).
- [ ] PR body uses "Refs #292" not "Closes #292" (Slice 4 closes the umbrella).

## Known deferrals / open questions

- **None for Slice 1.** Spec + RFC + #290 review have already resolved every Slice 1 decision: enum drop vs. additive (drop, per PR #290 L45); column-rename vs. `@map` (rename, RFC §2); migration-strategy (cast-and-recreate, RFC §2). No reviewer-facing decisions remain in this PR body.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Local dev DB has rows with old enum values (`SIZE_51_200`, `SIZE_201_PLUS`) — `USING orgSize::OrgSizeCategory` cast would fail. | Low | RFC §2 asserts "no production rows" because no UI ever wrote `sizeCategory`. Verified by grep: no seed script references the dropped values. If a dev's local DB contains a manually-inserted test row with one of the dropped values, migration fails loudly during `migrate dev`; that contributor must clean their DB (it is local-only data). |
| Postgres enum recreate is not transactionally safe for already-running queries reading the old enum. | Negligible | The `OrgSizeCategory` column is unindexed and unconstrained on a small table; no read paths depend on the enum order. |
| `_prisma_migrations` row already exists for an earlier draft. | Negligible | Fresh migration directory with new timestamp; no conflict. |

## Phase tracking

Tracked in TaskCreate task list (Tasks #1–#10). Phase 1 (this file) is in-progress; transition to Phase 4 (`implement-code`) on completion since Slice 1 has no `implement-tests` deliverable (schema-only PR; tests live with Slice 3).

---

## Validation Evidence (Phase 5 — implement-validate)

Migration applied against local Docker-backed Postgres (`customerEQ-postgres`, healthy for 3 days). Commands and outputs captured below; this satisfies the load-bearing pre-submission gate from the #170 PR1 P-MED lesson.

### `prisma validate`
```
Prisma schema loaded from prisma\schema.prisma
The schema at prisma\schema.prisma is valid 🚀
```

### `prisma migrate deploy`
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "customerEQ", schema "public" at "localhost:5432"
24 migrations found in prisma/migrations
Applying migration `20260507120000_org_settings_277`
The following migration(s) have been applied:
migrations/
  └─ 20260507120000_org_settings_277/
    └─ migration.sql
All migrations have been successfully applied.
```

(Note: `prisma migrate dev` requires a TTY and is blocked in non-interactive shells; `prisma migrate deploy` is the project's CI gate per #270 PR #280, and it is the production-equivalent path. The migration was applied cleanly to a DB that already held the prior 23 migrations including `20260507083000_brandtheme_surveytheme_split`.)

### Post-migration `brands` columns
```
 orgSize              | "OrgSizeCategory"              |           |          |
 timezone             | text                           |           | not null | 'UTC'::text
 locale               | text                           |           | not null | 'en-US'::text
```

(`sizeCategory` no longer present — rename succeeded; `timezone` and `locale` are NOT NULL with the RFC-specified defaults.)

### Post-migration `OrgSizeCategory` enum values
```
 SIZE_1_10
 SIZE_11_50
 SIZE_51_300
 SIZE_301_5000
 SIZE_5000_PLUS
 PREFER_NOT_TO_SAY
(6 rows)
```

(Six canonical buckets per RFC §1; `SIZE_51_200` and `SIZE_201_PLUS` removed.)

### `prisma migrate diff` (schema ↔ DB)
```
No difference detected.
```

### `prisma generate`
```
✔ Generated Prisma Client (v5.22.0) to .\..\..\node_modules\.pnpm\@prisma+client@5.22.0_prisma@5.22.0\node_modules\@prisma\client in 409ms
```

### `git status` (pre-stage)
```
modified:   packages/database/prisma/schema.prisma
Untracked files:
  docs/evidence/292-implement-work-list.md
  packages/database/prisma/migrations/20260507120000_org_settings_277/
```

(Three artifacts staged for this PR; no `package-lock.json` pollution. Clean diff.)
