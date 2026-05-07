# Issue #270 — Feature Implementation Evidence

**Issue**: [#270 — Migration 20260430000000_patch_survey_distribution_gap is not idempotent on a fresh DB](https://github.com/mathursrus/CustomerEQ/issues/276)
**Branch**: `feature/270-migration-20260430000000-patch-survey-distribution-gap-is-not-idempotent-on-a-fresh-db`
**Job**: feature-implementation (FRAIM)
**Standing Work List**: [`docs/evidence/270-implement-work-list.md`](./270-implement-work-list.md)

## Summary

Two-file fix for a P3009 cascade triggered by a non-idempotent recovery migration plus the CI gate that would have caught it. Validated against fresh and already-applied databases.

## Diff

| File | Lines added | Lines removed | Purpose |
|---|---|---|---|
| `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql` | +51 | -25 | Wrap 7 DDL blocks in idempotency guards (DO/EXCEPTION for tables/constraints, IF NOT EXISTS for indexes, conditional information_schema check for the cx_playbooks surveyType type swap). |
| `.github/workflows/ci.yml` | +13 | -0 | Switch `postgres:16` → `pgvector/pgvector:pg16` (required by migration #14 `add_kb_articles` per ADR-0002). Add `Run migrations (regression gate for #270)` step running `pnpm db:migrate` against the empty postgres service. |

## Validation

- **Fresh DB (AC1)**: Ephemeral `pgvector/pgvector:pg16` on port 15432, `prisma migrate deploy` applies all 20 migrations cleanly. Output ends `All migrations have been successfully applied.`
- **Already-applied DB via Prisma (AC2 weak form)**: Second `migrate deploy` against the same DB returns `No pending migrations to apply.`
- **Already-applied DB via direct psql (AC2 strong form)**: Piped `migration.sql` to psql with `ON_ERROR_STOP=1`. Output is only `NOTICE: ... already exists, skipping` and `DO` returns from EXCEPTION blocks. No errors. Proves the SQL itself is a verified no-op on a DB that already has every object the patch creates.
- **CI gate (AC3)**: Implemented; failure mode pre-validated locally — without the migration.sql fix, the new step emits `Error: P3018 / 42P07 ERROR: relation "survey_distributions" already exists`. With the fix, the step is green.

## Local sanity gates (project rule R11)

- `pnpm build`: 11/11 tasks PASS
- `pnpm typecheck`: 17/17 tasks PASS
- `pnpm lint`: 4/4 tasks PASS (0 errors, 6 pre-existing warnings)
- `pnpm test:smoke`: 390 / 391 PASS. Lone failure: `apps/api src/plugins/redis.test.ts > calls redis.quit on app close` (`TypeError: Cannot read properties of null (reading 'quit')`). Verified pre-existing flake unrelated to this change — passes in isolation in this worktree, passes 391/391 in main workspace under the same lockfile, and all 5 most recent CI runs on `main` are SUCCESS. Diff is SQL + YAML; no TypeScript surface that could touch a redis-mock test. Documented; not in scope for #270.

## Security Review

### Executive Summary

Diff-scope security review. Surfaces detected: **none** (`surfaces: []`). No findings. No fixes applied. No work items filed.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- Target: `feature/270-…` vs `origin/main`
- `surfaceAreaPaths`:
  - `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql`
  - `.github/workflows/ci.yml`
  - `docs/evidence/270-implement-work-list.md`
  - `docs/evidence/270-feature-implementation-evidence.md` (this file)

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| web | No | no `pages/` / `views/` / `public/**/*.{html,js,ts}` paths in diff |
| api | No | no `src/routes/**`, no `app.{get,post,put,delete,patch}` exports |
| llm-app | No | no anthropic/openai imports or prompt content |
| data-pipeline | No | SQL change is a static schema migration, not a data processor entrypoint |
| mobile | No | no `ios/**`, `android/**`, `.swift`, `.kt` |
| capability-authoring | No | only docs are under `docs/evidence/**` (operational evidence, not skill/job/rule/learning trees) |
| docs-only | No (since SQL+YAML present) | — |

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP Web Top 10 | N/A | No web surface |
| OWASP API Top 10 | N/A | No API surface |
| OWASP LLM Top 10 | N/A | No LLM surface |
| Capability-authoring review | N/A | No capability-authoring content |
| Secrets in code | Pass | The only credential-shaped string in diff is `DATABASE_URL: postgresql://customerEQ:customerEQ@localhost:5432/customerEQ_test` in `.github/workflows/ci.yml`. Identical pattern already used by sibling Prisma steps in the same file (lines 58, 66, 83). Matches the well-known CI test-DB pattern; not a production credential. |
| Privacy / PII | Pass | Migration patches DDL on `survey_distributions` (operational metadata: surveyId/memberId/brandId/sentAt) and `cx_playbooks`. No new PII flow, no new persistence of PII fields. The MemberId reference is a foreign key to existing PII storage, not a duplication. |
| GitHub Actions hygiene | Pass | New CI step uses `run:` only (no new `uses:`). No new unpinned actions introduced. The image swap (`postgres:16` → `pgvector/pgvector:pg16`) is a pinned-tag reference, matching the existing convention and ADR-0002. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Secrets scan: `grep -r 'sk_\|pk_\|password\s*=\s*["'\'']' <diff paths>` produced only the `customerEQ:customerEQ` test-DB pattern that already exists at file-level scope.
- PII scan: walked the schema delta — `survey_distributions(id, surveyId, memberId, brandId, sentAt)` carries no email/phone/name fields; the only personal pointer is the `memberId` foreign key, which already existed in the pre-patch schema.

### Applied Fixes and Filed Work Items

None.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

GDPR / CCPA / SOC2 / PCI-DSS are active per `fraim/config.json` `customizations.compliance.regulations`. The diff does not change PII processing, retention, access controls, or auth flows; no control rows are touched.

### Run Metadata

- Run date: 2026-05-04
- Branch: `feature/270-…`
- Reviewed paths: 4 (2 source, 2 evidence)
- Skill errors: none
- Caps hit: none
- Environment: Windows 11 / Git Bash / Docker Desktop / pgvector/pgvector:pg16

## Completeness Review

### Feature Requirement Traceability Matrix

Source of truth: issue #270 acceptance criteria (no separate feature spec for a P-MED migration bug).

| Requirement / Acceptance Criterion | Implemented File / Function | Proof | Status |
|---|---|---|---|
| AC1 — `pnpm db:reset --force` against a fresh postgres container completes all 20 migrations cleanly. | `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql` (idempotency wraps on the 7 unguarded DDL blocks). | Local repro on ephemeral `pgvector/pgvector:pg16` (port 15432): `prisma migrate deploy` ends `All migrations have been successfully applied.` See § Validation. | Met |
| AC2 — On a DB that already had the patch applied in current broken-state form, the new patch is a verified no-op (regression test or documented manual verification). | Same file. | (a) Second `prisma migrate deploy` run: `No pending migrations to apply.` (b) Direct `psql -v ON_ERROR_STOP=1 -f migration.sql` on the post-applied DB: only `NOTICE: ... already exists, skipping` and `DO` returns. No errors. See § Validation. | Met |
| AC3 — CI gains a `prisma migrate deploy` step against an empty postgres service so this kind of regression is caught next time. | `.github/workflows/ci.yml` — added `Run migrations (regression gate for #270)` step + switched the postgres service to `pgvector/pgvector:pg16` (required by migration #14 `add_kb_articles`). | Step authored; failure mode pre-validated locally (without the migration.sql fix the step emits P3018 / 42P07). Authoritative pass will appear on the PR's CI run. | Met (CI gate active; PR run pending) |

No `Partial` / `Unmet` rows. No missed commitments.

### Technical Design Traceability Matrix

Source of truth: issue #270 "Fix" section (no separate RFC — the issue body specifies the exact fix shape; design discussion happened in this conversation, captured in the work list).

| Design Commitment | Implementation | Proof | Status |
|---|---|---|---|
| Wrap unconditional `CREATE TABLE "survey_distributions"` in `DO $$ BEGIN … EXCEPTION WHEN duplicate_table THEN NULL; END $$;`. | `migration.sql` lines for "Section 2 — Create survey_distributions". | Idempotent psql replay (NOTICE: skipping). | Met |
| Wrap the `ALTER TABLE "cx_playbooks"` `DROP+ADD COLUMN "surveyType"` in a conditional check that the column is still TEXT (so the recovery path runs only when needed). | `migration.sql` "Section 1 — Fix cx_playbooks" — `IF EXISTS (SELECT … data_type = 'text')` guard. | Fresh-DB run: condition is false, the DROP+ADD is skipped, subsequent timestamp ALTERs and index recreation succeed. | Met |
| Apply the same wrapping to the remaining unguarded indexes and FKs (the issue body explicitly notes "Same wrapping for the `ALTER TABLE cx_playbooks` block"; extended scope per the work list to cover all 7 unguarded blocks discovered on read). | `migration.sql` — `CREATE INDEX IF NOT EXISTS` for 3 indexes; `DO/EXCEPTION` for 2 FK constraints. | Idempotent psql replay; `pnpm db:migrate` on fresh DB clean. | Met (extended scope documented in § Diff and work list) |
| CI postgres image must support pgvector (precondition for migrate-deploy gate to actually run migration #14). | `.github/workflows/ci.yml` — `postgres` service image switched to `pgvector/pgvector:pg16`. | Inline comment cites ADR-0002; image already used locally per docker-compose. | Met |

No deviations. The extension of scope from "wrap two blocks" (issue body's example) to "wrap all seven unguarded DDL blocks" is intentional and was surfaced explicitly in the work list (§ Scope) so the technical design is consistent with the implementation.

### Feedback Verification

No `docs/evidence/270-feature-implementation-feedback.md` exists (no human or quality feedback rounds yet — pre-PR phase). Phase has nothing to verify; will become the live tracking surface for any reviewer feedback after PR submission.

### Standing Work List Closeout

All in-scope items in `docs/evidence/270-implement-work-list.md` are accounted for above. The two intentional out-of-scope deferrals from the work list (`refactor the patch into a forward migration`, `extract DATABASE_URL to workflow-level env`) are not addressed here and remain flagged as future work — not blockers for #270.

## Quality Review

No findings.

| Check | Result |
|---|---|
| Hardcoded values | Pass. The CI `DATABASE_URL` matches the repo's established CI test-DB pattern (sibling steps already use the same string). SQL types (`TEXT`, `TIMESTAMP(3)`, `"SurveyType"`) are schema literals, not configuration. |
| Duplication / DRY | Pass. The new idempotency wrappers reuse the exact `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` pattern already used by the FK constraints lower in the same file (lines 95-142 in the pre-edit version). The `IF NOT EXISTS` index pattern matches the lower indexes (lines 57-93 in the pre-edit version). |
| Reuse before create | Pass. No new utility functions; no new constants files; the `information_schema.columns` check is the standard Postgres-idiomatic way to gate a column-type swap. |
| Architecture standards | Pass. No layering violations (DDL stays in the migrations directory). No environment-variable changes. |
| File size | Pass. Migration: 170 lines (was 142, +28 from idempotency guards). CI workflow: 174 lines (was 161). Both well under the 500-line guidance. |
| Complexity | Pass. Nested logic depth ≤ 1 (a single `IF EXISTS` check inside one `DO $$ BEGIN ... END $$;`). No new functions, no parameter lists. |

