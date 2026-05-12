# Issue #325 — Feature Implementation Evidence

Slice 1 of #241 (umbrella #324). Schema deltas + D50 fan-out migration.

Branch: `feature/241-slice-1-schema-migration`
Work-list: [325-implement-work-list.md](./325-implement-work-list.md)

---

## Security Review

### Executive Summary

- **Findings**: 0
- **Severity counts**: Critical 0, High 0, Medium 0, Low 0
- **Dispositions**: 0 fix, 0 file, 0 accept
- **Outcome**: Pass — proceed to `implement-regression`.

No exploitable security findings on the Slice 1 diff. The change set is a schema migration (column add/drop, enum rename) plus removal of references to dropped fields across API/web/test code; it removes attack surface (mass-assignment of an unused `incentivePoints` field) rather than adding any.

### Review Scope

- **reviewType**: `embedded-diff-review`
- **reviewScope**: `diff`
- **Diff target**: `feature/241-slice-1-schema-migration` vs `main` (commit `b10181c`)
- **surfaceAreaPaths**: all files in `git status` for this branch (Prisma schema, hand-edited migration SQL, API routes in `apps/api/src/routes/`, Zod schemas, integration & unit tests, web admin UI, MCP-server tool definitions, seed script, new test-utils helper)

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| `web` | yes | `apps/web/src/app/(admin)/admin/surveys/page.tsx` and `[id]/page.tsx` modified (enum string rename `CLOSED`→`STOPPED`; reference to `survey.incentivePoints` removed from rendering paths slated for Slice 4 deletion). |
| `api` | yes | `apps/api/src/routes/{surveys,public,developer,analytics}.ts` modified (dropped reads of `Survey.incentivePoints` / `showIncentivePoints`; renamed `'CLOSED'` to `'STOPPED'` in `where` filters; removed the secondary `cx.survey_completed` emit). |
| `data-pipeline` | yes | New migration `packages/database/prisma/migrations/20260512000000_survey_admin_ux_241_slice_1/migration.sql` — hand-edited SQL with raw INSERT/DELETE/ALTER per the architecture §3.4 ordering. No user input touches this script. |
| `llm-app` | no | No imports of `anthropic` / `openai` SDKs in the diff; no prompt content added. |
| `mobile` | no | No `ios/` or `android/` changes. |
| `capability-authoring` | no | No skills/jobs/rules/template files modified. |
| `docs-only` | no | Diff contains code, schema, and SQL. |

### Coverage Matrix

| Category | Result | Notes |
|---|---|---|
| A03 Injection — SQL string concat | **Pass** | Migration SQL is hand-edited static text — no user-controlled interpolation. `$tag$` PL/pgSQL guard is parameter-free. API-route changes are field removals, not new query construction; no `prisma.$queryRawUnsafe`/`$executeRawUnsafe` introduced in app code (only in the test-only `setupMigrationTestDb` helper). |
| A03 Injection — XSS / innerHTML | **Pass** | The widget JS template in `public.ts` had two `survey.incentivePoints` reads in template strings; both blocks were deleted (D19: points never appear on the form). No new innerHTML sinks. |
| A05 Misconfiguration — secrets in code | **Pass** | Diff contains no new hardcoded credentials, API keys, tokens, or signing secrets. The `credentialRef: 'secret_123'` and `<YOUR_API_KEY>` strings flagged by the grep are pre-existing test fixtures and code-sample placeholders unchanged by this PR. |
| A05 Misconfiguration — CORS / headers | **N/A** | No CORS or header changes. |
| A04 Insecure Design — mass assignment | **Pass / reduced** | `CreateSurveySchema` and `UpdateSurveySchema` had two fields dropped (`incentivePoints`, `showIncentivePoints`). Zod's default strip semantics now silently ignore those keys if a client supplies them — the attribute surface that an attacker could mass-assign shrinks. No new fields were added in this slice. |
| API1 Broken Object Level Auth | **N/A** | No new endpoints. Existing endpoints retain their `request.brandId` brand-scoping. |
| API2 Broken Authentication | **N/A** | No auth code touched (file paths under `auth/`, `session/`, `jwt/`, `oauth/`, `mfa/` not in the diff). |
| API3 Broken Object Property Level Auth | **Pass** | The `select: { ..., incentivePoints: true }` clauses removed across `public.ts`/`developer.ts`/`surveys.ts` actually tighten what the API exposes. The dedicated consent-mode endpoint is Slice 2's responsibility; not in this diff. |
| API8 Security Misconfiguration | **Pass** | Migration is wrapped in `BEGIN; … COMMIT;` with idempotent guards. Postgres ALTER TYPE RENAME VALUE is replay-safe under the PL/pgSQL guard. |
| Privacy / PII | **Pass** | No PII fields added or exposed. `Survey.title` is operator-facing form heading — not respondent data. The D50 fan-out copies operator-set `pointsAwarded` values from `Survey.incentivePoints` to `EarningRule` rows; no PII flows. |
| Secrets in code (full scan) | **Pass** | No new patterns matching `AKIA*`, `sk_live_*`, `sk_test_*`, bearer/password literals, or hex blobs of secret-like length in any added or modified file. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Diff inspected via `git diff main`.
- Grep of diff for `AKIA|API_?KEY|SECRET|TOKEN|password|bearer|sk_live|sk_test` returned only pre-existing fixture/placeholder strings (already present on `main`).
- Grep of migration SQL for `${`, `format(`, `EXECUTE …||` returned 0 hits — no dynamic SQL string assembly.
- Grep of new test-utils helper for `password|secret|token` returned 0 hits.
- `pnpm typecheck`, `pnpm build`, `pnpm lint` all green.
- `pnpm test` (1191 unit tests) green.
- `pnpm test:integration` (348 integration tests, including new 9-test 5-fixture migration suite) green against the migrated DB.
- Manual `pnpm db:migrate` against a fresh DB applied all 26 migrations cleanly; second `db:migrate` reported "No pending migrations to apply" (idempotency verified).

### Applied Fixes and Filed Work Items

None — no findings.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

No regulations active for this issue; mapping N/A.

### Run Metadata

- Date: 2026-05-11
- Diff target: `feature/241-slice-1-schema-migration` vs `main` @ `b10181c`
- Skill errors: none
- Auto-fix cap: 0/10 (no findings)
- Environment: Windows 11 + Docker Desktop + pgvector/pgvector:pg16 + Node 22 + pnpm 11.1.0

---

## Feature Requirement Traceability Matrix

Source of truth: issue [#325](https://github.com/mathursrus/CustomerEQ/issues/325) body (Acceptance section).

| Requirement / Acceptance Criterion | Implemented File / Function | Proof | Status |
|---|---|---|---|
| Migration applies cleanly against a fresh DB | `packages/database/prisma/migrations/20260512000000_survey_admin_ux_241_slice_1/migration.sql` | Manual run: `pnpm db:migrate` against fresh DB → "All migrations have been successfully applied." | Met |
| Migration replay is a no-op | Same migration file; `IF EXISTS`/`IF NOT EXISTS` guards + `NOT EXISTS` subquery for fan-out + PL/pgSQL `DO $$` guard around `ALTER TYPE RENAME VALUE` | Manual: second `pnpm db:migrate` → "No pending migrations to apply." | Met |
| 5 brand-fixture migration tests pass | `apps/api/test/integration/survey-admin-ux-slice1-migration.test.ts` | `pnpm --filter @customerEQ/api test:integration -t 'D50 fan-out migration'` → 9 tests pass (5 fixture-specific + 4 structural). | Met |
| All existing tests still pass | `themes-291-migration.test.ts`, `public.test.ts`, `developer.test.ts`, `public-survey.test.ts`, `survey-lifecycle.test.ts`, `surveys.test.ts`, `survey.schema.test.ts` all updated where assertions referenced the dropped fields | `pnpm test:all` → 17/17 turbo tasks pass (1191 unit + 348 integration). | Met |
| No reference to dropped fields in production code | All read-sites removed from `apps/api/src/routes/*`, `apps/web/src/app/survey/[id]/page.tsx`, `apps/web/src/app/(admin)/admin/{developer,surveys}/page.tsx`, `apps/mcp-server/src/tools/surveys.ts`, all `apps/demo-storefront/**` pages, `scripts/seed-demo.ts`. CLOSED→STOPPED everywhere SurveyStatus is used. | `grep -rln 'incentivePoints'` returns only intentional matches (removal comments, `toBeUndefined()` assertions, the migration test that seeds pre-migration state). | Met (with documented intentional matches — see Deviations) |
| `pnpm audit --audit-level=high` still green | No new dependencies added in Slice 1 | Inherited from #321 bump's clean baseline. | Met |

### Deviations

- **Intentional grep matches**: ~6 files retain the `incentivePoints` / `showIncentivePoints` strings strictly in (a) inline comments documenting the removal, (b) test assertions of the form `expect(...).toBeUndefined()`, and (c) the new migration test which seeds pre-migration column state via raw SQL. These are not production reads.
- **Slice-4-bound minimum-touch**: `apps/web/src/app/(admin)/admin/{survey-builder,surveys/new,surveys/[id]}/page.tsx` retain references. Per the work-list these files are slated for deletion / rewrite in Slice 4; tsc passes because the relevant types are locally declared as optional, and runtime reads return `undefined` so the conditional UI branches simply do not render. Classification: intentional tradeoff, documented in the work-list at scoping time.

---

## Technical Design Traceability Matrix

Source of truth: [`docs/rfcs/241-survey-admin-ux.md`](../rfcs/241-survey-admin-ux.md) §Schema Changes, §Migration plan, §Implementation slicing row 1.

| Design Commitment | Implementation | Proof | Status |
|---|---|---|---|
| Add `Survey.title String?` (nullable) | `packages/database/prisma/schema.prisma` Survey model; migration block 1 | Direct psql: `information_schema.columns` returns `title \| YES`. | Met |
| Backfill `Survey.title` from `Survey.name` | migration.sql block 1 `UPDATE … SET title = name WHERE title IS NULL` | Test: "Survey.title is backfilled from Survey.name" → pass. | Met |
| Drop `Survey.incentivePoints` | schema.prisma + migration block 3 | Test: "incentivePoints and showIncentivePoints columns are dropped" → pass. | Met |
| Drop `Survey.showIncentivePoints` | schema.prisma + migration block 3 | Same test as above. | Met |
| Rename `SurveyStatus.CLOSED → STOPPED` via PL/pgSQL guarded `ALTER TYPE RENAME VALUE` | migration block 4 | Test: "SurveyStatus enum has STOPPED and not CLOSED" → pass; psql confirms `{DRAFT, ACTIVE, PAUSED, STOPPED}`. | Met |
| D50 fan-out — `Survey.incentivePoints > 0` rows become per-type cx `EarningRule` with `MODE()` pointsAwarded | migration block 2a; `NOT EXISTS` guard against double-write | Tests: fixtures 1 ("only-survey-incentive": one cx.nps_response with pointsAwarded=50) and 3 ("both": superset). | Met |
| D50 fan-out — dead `EarningRule(triggerEvent='survey_completion')` rows fan out by `JOIN LATERAL DISTINCT` over a program's actual survey types, then are DELETEd | migration block 2b | Test: fixture 2 ("only-dead-rule": NPS + CSAT split, dead rule gone). | Met |
| `NOT EXISTS` guard skips when a live cx rule already exists | migration block 2a `WHERE NOT EXISTS (… er."triggerEvent" = …)` | Test: fixture 4 ("live-cx-only": no new rules created). | Met |
| Idempotent under repeated `migrate deploy` (#270 lessons) | `IF EXISTS` / `IF NOT EXISTS` + `NOT EXISTS` subquery + `DO $$` guard around enum rename + `survey_completion` rule delete is naturally idempotent | Manual: second `pnpm db:migrate` is no-op. | Met |
| All steps within `BEGIN; … COMMIT;` (architecture §3.4 ordering) | migration.sql wrapper | Inspected file. | Met |
| 5-brand fixture coverage matrix per RFC | `survey-admin-ux-slice1-migration.test.ts` | 9 tests pass (4 structural + 5 fan-out). | Met |
| Worker code unchanged (D50 = zero-worker-change) | `apps/worker/**` not in diff | `git diff main -- apps/worker/` empty. | Met |
| Slice 2 additions deferred | No new endpoint, no state-aware allowlist, no isScoreField, no requestIp capture in this PR | `git diff` review — Slice 2 surface absent. | Met (deferred to Slice 2 as designed) |

### Deviations

- **Test infrastructure scope addition** — `packages/config/src/test-utils/db/setup-migration-test-db.ts` added to support genuine pre/post-migration testing. The RFC's "fixture coverage" intent requires it; the prior `setupTestDb` uses `prisma db push` which collapses migrations. Reusable for future migration tests. Approved at scoping (work-list § Open Questions, option C confirmed).
- **ID-generation substitution** — RFC sample SQL used `gen_random_bytes(12)` (pgcrypto). No prior migration installs pgcrypto. Replaced with the codebase's existing `substr(md5(random()::text || clock_timestamp()::text), 1, 24)` pattern from `_org_settings_277/migration.sql`. Functionally equivalent (24-char random hex prefix); avoids a new extension dependency.

---

## Feedback Verification

| Source | Items | Status |
|---|---|---|
| `docs/evidence/325-feature-implementation-feedback.md` (quality) | 0 unaddressed | All quality checks pass on first sweep — no QUALITY CHECK FAILURE items recorded. |
| Human review feedback (PR comments) | N/A | PR not yet opened (Phase 11). |

---

## Standing Work List → Evidence Promotion

Durable outcomes promoted from `325-implement-work-list.md`:

- **Validation modes required**: `uiValidationRequired = false`, `mobileValidationRequired = false` (Slice 1 is schema + migration + mechanical refactor, no new UI). Both consciously skipped.
- **Key decisions**:
  - Migration-test infrastructure built as Option C (`setupMigrationTestDb` helper) rather than Option A (structural-only) or Option B (SQL-text re-injection). Confirmed by user during scoping.
  - `gen_random_bytes` substituted with `md5(random())` pattern after the pgcrypto dependency surfaced at runtime.
  - Files queued for Slice 4 deletion (`survey-builder/page.tsx`, `surveys/new/page.tsx`, `surveys/[id]/page.tsx`) received minimum-touch only.
- **Deferrals**: All Slice 2 work — new fields on `CreateSurveySchema`, `consent-mode` endpoint, audit `requestIp` capture, state-aware allowlist, `isScoreField` per-question config — confirmed in issue body's "Out of scope for Slice 1" section.
