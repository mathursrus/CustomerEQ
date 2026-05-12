# Issue #325 — Slice 1: schema deltas + D50 fan-out migration

**Umbrella**: [#324](https://github.com/mathursrus/CustomerEQ/issues/324)
**Spec**: [docs/feature-specs/241-survey-admin-ux.md](../feature-specs/241-survey-admin-ux.md)
**Design**: [docs/rfcs/241-survey-admin-ux.md](../rfcs/241-survey-admin-ux.md)
**Issue type**: feature
**Branch (planned)**: `feature/241-slice-1-schema-migration` off `main`

---

## Implementation Checklist

### A. Schema (`packages/database/prisma/schema.prisma`)
- [ ] `Survey.title String?` — add nullable; backfilled from `name` in migration
- [ ] Drop `Survey.incentivePoints Int?`
- [ ] Drop `Survey.showIncentivePoints Boolean` (default TRUE today)
- [ ] Rename `SurveyStatus.CLOSED` → `SurveyStatus.STOPPED`

### B. Migration (`<TIMESTAMP>_survey_admin_ux_241_slice_1/migration.sql`)
Single hand-edited forward migration, block-ordered, idempotent under repeated `migrate deploy` (#270 lessons). Pattern follows `20260507083000_brandtheme_surveytheme_split` and `20260504000000_survey_response_data_model_rework`:

- [ ] Block 1 — `ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title" TEXT`; `UPDATE … SET "title" = "name" WHERE "title" IS NULL`
- [ ] Block 2a — D50 fan-out (incentivePoints branch): `INSERT INTO "earning_rules" … FROM "surveys" WHERE "incentivePoints" > 0 GROUP BY ("programId","brandId", type)` with `MODE() WITHIN GROUP` for `pointsAwarded`. `WHERE NOT EXISTS` guard against `(programId, triggerEvent=cx.<type>_response)` already-present.
- [ ] Block 2b — D50 fan-out (dead-rule branch): per `EarningRule(triggerEvent='survey_completion')`, INSERT one rule per cx event type that the program's surveys actually use (`JOIN LATERAL DISTINCT CASE`). Then `DELETE FROM "earning_rules" WHERE "triggerEvent" = 'survey_completion'`.
- [ ] Block 3 — `ALTER TABLE "surveys" DROP COLUMN IF EXISTS "incentivePoints"`; `DROP COLUMN IF EXISTS "showIncentivePoints"`
- [ ] Block 4 — `ALTER TYPE "SurveyStatus" RENAME VALUE 'CLOSED' TO 'STOPPED'` wrapped in `DO $$ … END $$` PL/pgSQL guard
- [ ] Wrap blocks 1–4 in `BEGIN; … COMMIT;`

### C. Consumer-code updates (CLOSED→STOPPED, drop incentive fields)

**SurveyStatus rename — 7 production files + 4 tests (verified-distinct from `ConversationStatus.CLOSED`)**:
- [ ] `packages/shared/src/zod/survey.schema.ts:97` — `z.enum(['ACTIVE', 'PAUSED', 'CLOSED'])` → `['ACTIVE', 'PAUSED', 'STOPPED']`
- [ ] `apps/api/src/routes/surveys.ts`
- [ ] `apps/api/src/routes/analytics.ts:394`
- [ ] `apps/mcp-server/src/tools/surveys.ts:62`
- [ ] `apps/web/src/app/(admin)/admin/surveys/page.tsx` (lines 12, 36)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` (lines 28, 53, 400, 420, 423)
- [ ] `apps/api/src/routes/surveys.test.ts`
- [ ] `apps/api/test/integration/survey-lifecycle.test.ts`
- [ ] `apps/api/test/integration/public-survey.test.ts`
- [ ] `apps/api/test/integration/members.test.ts` (verify SurveyStatus context, not Conversation/Case)

**`incentivePoints` drop — 17 production files + 7 tests**:
- [ ] `packages/shared/src/zod/survey.schema.ts` — drop from `CreateSurveySchema` + `UpdateSurveySchema` (2 hits)
- [ ] `apps/api/src/routes/surveys.ts` (3 hits)
- [ ] `apps/api/src/routes/public.ts` (12 hits — biggest single-file change; public GET/list shape)
- [ ] `apps/api/src/routes/developer.ts` (2 hits)
- [ ] `apps/mcp-server/src/tools/surveys.ts` (1)
- [ ] `apps/web/src/app/(admin)/admin/surveys/page.tsx` (2)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` (2)
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (8) — minimum-touch (deleted in Slice 4)
- [ ] `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` (5) — minimum-touch (deleted in Slice 4)
- [ ] `apps/web/src/app/(admin)/admin/developer/page.tsx` (2)
- [ ] `apps/web/src/app/survey/[id]/page.tsx` (5) — public renderer; will be rebuilt in Slice 4
- [ ] `apps/demo-storefront/src/app/api/storefront/surveys/route.ts` (1)
- [ ] `apps/demo-storefront/src/app/checkout/confirm/page.tsx` (2)
- [ ] `apps/demo-storefront/src/app/survey/[id]/page.tsx` (8)
- [ ] `apps/demo-storefront/src/app/surveys/page.tsx` (3)
- [ ] `scripts/seed-demo.ts` (2)
- [ ] `packages/config/src/test-utils/factories/survey.factory.ts` (4)
- [ ] Tests: `surveys.test.ts`, `public.test.ts` (6), `developer.test.ts` (3), `public-survey.test.ts` (5), `survey.schema.test.ts` (2), `survey-creation.spec.ts`, `survey-rule-builder.spec.ts` (5)

**`showIncentivePoints` drop — 6 production files + 3 tests**:
- [ ] `packages/shared/src/zod/survey.schema.ts` (2)
- [ ] `apps/api/src/routes/surveys.ts` (2)
- [ ] `apps/api/src/routes/public.ts` (1)
- [ ] `apps/web/src/app/survey/[id]/page.tsx` (3)
- [ ] `apps/web/src/components/themes/ThemeForm.tsx` (1) — vestigial ref; theme split was #291
- [ ] `scripts/seed-demo.ts` (3)
- [ ] Tests: `survey.schema.test.ts` (8), `themes-291-migration.test.ts` (6 — asserts column moved in #291; update to assert column now dropped), `themes-crud-pattern.spec.ts` (1)

**Out of scope for Slice 1** (Slice 2 owns):
- Adding `title`, `description`, `responsePolicy`, `consentTextOverride` to `CreateSurveySchema`
- New `PATCH /v1/surveys/:id/consent-mode` endpoint
- `AuditEvent.metadata.requestIp` capture
- State-aware field allowlist enforcement
- `isScoreField` per-question config

### D. Migration tests (`apps/api/test/integration/survey-admin-ux-slice1-migration.test.ts`)

5 brand-fixture cases per the RFC's "Fixture coverage" table. Each fixture pre-seeds a brand with a known starting state, applies the migration (already applied via setup), and asserts the post-migration EarningRule shape.

- [ ] Fixture 1 — `brand-only-survey-incentive`: 3 NPS surveys with `incentivePoints=50`, no live EarningRule → assert 1 new `EarningRule(triggerEvent='cx.nps_response', pointsAwarded=50)`
- [ ] Fixture 2 — `brand-only-dead-earningrule`: 1 dead rule + mix of NPS/CSAT surveys with `incentivePoints=null` → assert 2 new rules (NPS + CSAT), dead rule gone
- [ ] Fixture 3 — `brand-both`: union of fixtures 1 + 2 → assert superset
- [ ] Fixture 4 — `brand-live-cx-only`: live `cx.nps_response` rule (pointsAwarded=100), no `incentivePoints`, no dead rules → assert no new rules (NOT EXISTS guard)
- [ ] Fixture 5 — `brand-neither`: nothing → assert no migration writes

**Note**: the migration runs as part of test DB setup, so fixture preseed must happen via raw SQL (insert before-migration state, then `pnpm db:migrate` re-applies blocks). Likely simpler: run fixtures and assertions against the migration's idempotent re-application — the second `migrate deploy` is a no-op so the fan-out logic only fires once. This needs implementation-time verification.

### E. Local gates (before push)
- [ ] `pnpm db:migrate` clean against a fresh DB
- [ ] `pnpm db:migrate` second run is a no-op (idempotency)
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm test` (unit)
- [ ] `pnpm test:integration` (incl. new 5-fixture migration test)
- [ ] `pnpm audit --audit-level=high` (still clean)
- [ ] Grep verification: no remaining `incentivePoints`, `showIncentivePoints`, or `SurveyStatus\.CLOSED|'CLOSED'.*Survey` references in non-migration files

---

## Validation Requirements

- `uiValidationRequired`: **No**. Slice 1 is schema + data migration + mechanical code updates. No new UI; existing UI changes are strictly enum-rename / field-drop with no visual change.
- `mobileValidationRequired`: No.
- Database validation: required. 5 fixtures × pre/post-migration state.
- Manual validation: `pnpm db:migrate` on fresh DB, replay no-op verification.

---

## Patterns Discovered (codebase-pattern-discovery)

**Migration conventions** (from `_brandtheme_surveytheme_split` and `_survey_response_data_model_rework`):
- Block-numbered SQL with `── N. Title ──` separators
- `BEGIN; … COMMIT;` wrapping
- `IF EXISTS` / `IF NOT EXISTS` guards for replay safety
- Header comment with strategy rationale and rollback note
- Backfill column → drop column ordering (per `architecture.md §3.4`)
- PL/pgSQL `DO $$ … END $$` for non-idempotent statements like `ALTER TYPE … RENAME VALUE`

**Test fixture patterns** (from `packages/config/src/test-utils/factories/`):
- Per-domain factories (`survey.factory.ts`, `brand.factory.ts`, etc.)
- Factories accept overrides; sensible defaults; named exports `createSurvey`, `createBrand`
- Integration tests live in `apps/api/test/integration/` with `*.test.ts` suffix

**Zod schema patterns** (from `packages/shared/src/zod/survey.schema.ts`):
- `CreateSurveySchema` and `UpdateSurveySchema = CreateSurveySchema.partial()` paired pattern
- Status enums use string-literal `z.enum(['DRAFT', 'ACTIVE', ...])` (no Prisma enum direct re-export)
- Test file lives alongside schema file as `*.schema.test.ts`

**Environment variables**: standard project pattern. `DATABASE_URL`, `REDIS_URL`, `CLERK_SECRET_KEY` for tests. No new env vars introduced in Slice 1.

**Architectural patterns referenced**:
- `apps/web/architecture.md §3.4` — migration column ordering
- Project rule §11 + `.github/workflows/ci.yml:75` — `pnpm test:integration` is the gate (note: actually it isn't today; see #323)

---

## Open Questions / Deferrals

- **Q1** (resolved): How to test the migration's fan-out? — Answer: per-fixture brand pre-seed via factory + assert post-state. Implementation detail per phase 3.
- **Deferred to Slice 4**: `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` and `survey-builder/page.tsx` are slated for deletion. Slice 1 makes minimum-viable touches (drop `incentivePoints` reads) to keep them compiling.
- **Deferred to Slice 2**: All Zod schema *additions* (title, description, responsePolicy, consentTextOverride). Slice 1 only drops.
- **Architecture-doc updates**: Slice 1 introduces no new patterns; the architecture-doc updates (MA1/MA2/MA3) belong to Slice 2 and Slice 4. Phase 10 of this workflow will confirm "no change needed" rather than make changes.

---

## Phase log

- 2026-05-11 — FRAIM phase 1 (implement-scoping) complete.
