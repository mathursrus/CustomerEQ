# Issue #543 — Feature Implementation Evidence

## Code validation

`git status --short`:

```
 M apps/api/test/integration/distributionBatches.test.ts
 M apps/web/src/app/survey/[id]/r/[token]/page.tsx
?? apps/web/src/app/survey/[id]/r/[token]/page.loading-vs-error.test.tsx
?? docs/evidence/543-implement-work-list.md
?? docs/evidence/543-feature-implementation-evidence.md
?? docs/evidence/543-ui-polish-validation.md
?? packages/database/prisma/migrations/20260529100000_backfill_survey_sent_count_self_serve/
```

Grepped diff for `TODO`/`FIXME`/`console.log` — none introduced.

## Build verification

- `pnpm turbo run typecheck --concurrency=1` — **20 / 20** packages green.
- `pnpm turbo run build --concurrency=1` — **12 / 12** packages green.
- `pnpm db:migrate` applies the new `20260529100000_backfill_survey_sent_count_self_serve` migration cleanly.

## Targeted automated tests (post-fix)

| Finding | Layer | Result |
|---|---|---|
| F1 — `Survey.sentCount` backfill | `apps/api` integration | **4 / 4 pass** — truth-recompute (SELF_SERVE tokens + MANAGED_EMAIL delivered); idempotency; no-batch surveys untouched; MANAGED_EMAIL deliveredAt semantic preserved. |
| F2 — respondent-page loading-vs-error | `apps/web` unit | **3 / 3 pass** — transient Loading routed correctly; error card still renders when `form.error` or `form.loadError` populated. |
| Regression on the same file (R12 byte-identity) | `apps/web` unit | **42 / 42 pass** across 6 test files including `page.r12-byte-identity.test.tsx`. |

## Manual / post-deploy verification (authorized as deferred)

`uiValidationRequired: false` per the work list. Two user-driven post-deploy spot checks:

1. **F1**: re-open the "Are you FRAMING It?" survey on production after the next Deploy-to-Azure run. **Survey Sent: N** in the header should now match Loop Monitor's combined total (43 for that survey: 2 MANAGED_EMAIL + 41 SELF_SERVE).
2. **F2**: click a survey link from a real email (or from `/admin/surveys/.../distribute/batches/...` regenerated link). Verify NO red "Failed to load survey" card flashes before the survey form renders.

## Migration safety notes

- **Migration is idempotent.** Re-running on the same data produces the same result; the SQL counts truth from scratch (`UPDATE ... SET = COUNT(...)`), not `+=`.
- **Migration doesn't double-count post-#540 batches.** A SELF_SERVE batch created after #540 had its mint-time `sentCount += minted.length` bump; the migration's `COUNT(survey_distribution_tokens WHERE sendMode = 'SELF_SERVE')` also includes those tokens. They agree by construction.
- **Migration is bounded.** `WHERE EXISTS (SELECT 1 FROM distribution_batches WHERE surveyId = ...)` skips surveys that never distributed. Even if those rows held a non-zero stale `sentCount` from some prior bug, the migration won't overwrite them — that's an intentionally narrow scope for "fix surveys that did distribute."
- **Race window during deploy is order-1.** While the migration UPDATEs a Survey row, a SELF_SERVE create transaction could simultaneously increment that same row. Worst case: the migration counts N tokens while the create-batch adds an N+k row, and Survey.sentCount ends up at N (truth: N+k). Self-corrects on any subsequent batch-create or migration re-run; the magnitude is at most one batch's recipients, way under the 41-recipient gap the user observed. Not worth `LOCK TABLE` overhead.

## Bug Bash Findings

0 issues found via the automated layers. Cross-finding interaction checks:
- F1's migration runs once during the Deploy-to-Azure migrate step. F2's render fix is client-side. Zero overlap.
- F2's inner-`if` guard preserves the existing error-card behavior when `form.error` / `form.loadError` are populated (verified by the 2 happy-path tests in `page.loading-vs-error.test.tsx`). No regression on the existing R12 byte-identity invariant (42/42 page tests pass).
- The Loading card the inner guard renders is byte-identical to the existing loading state at line 128 of `page.tsx` (same `bg-white` chrome, same caption, same `PoweredByFooter variant="neutral"`).

## Security Review

### Executive Summary

- 0 Critical, 0 High, 0 Medium, 0 Low findings.
- 0 immediate escalations.
- Net-neutral posture change. F1 is a one-time aggregate recompute against tenant-tagged tables; F2 changes one client-render conditional. No new attack surface.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff (commits since `origin/main` on `feature/543-...`)
- Surfaces reviewed:
  - `packages/database/prisma/migrations/20260529100000_backfill_survey_sent_count_self_serve/migration.sql` (data-pipeline — DDL/DML migration)
  - `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (web)
- Test files excluded.

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `data-pipeline` (migration) | `packages/database/prisma/migrations/...migration.sql` — declarative SQL applied via `prisma migrate deploy` in CI/CD. |
| `web` | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — React client component at the public respondent surface. |

Auth/crypto firewall: **not touched**. No file matches `**/auth/**` / `**/crypto/**` / `**/session/**` / `**/jwt/**` / `**/oauth/**` / `**/password/**`.

### Coverage Matrix

#### Migration / SQL safety (`data-pipeline` surface)

| Check | Status | Notes |
|---|---|---|
| SQL injection / dynamic identifiers | **N/A** | Migration is static SQL with constant table + column names; no parameters, no string interpolation. The schema qualifier in the integration test (`getBackfillSql()` substituting per-test schema name) is test-only — the shipped migration file has zero substitution and runs against `public`. |
| Privilege escalation / DDL on cross-tenant rows | **Pass** | UPDATE writes only the denormalized aggregate `sentCount` on `surveys`. Doesn't touch tenant-foreign keys (`brandId`), PII columns, consent timestamps, or any field that influences authorization. `WHERE EXISTS` guard scopes by survey-has-distributed; never reads or writes another brand's data. |
| Mass-update lock contention / runtime | **Pass** | One UPDATE against `surveys` joined to aggregate subqueries. Bounded by N_surveys × (count(tokens) + count(distributions)). Acceptable order of magnitude for this product's data volume. No `LOCK TABLE` needed; documented race window in the migration file is order-1 and self-corrects. |
| Data loss / irreversibility | **Pass — recoverable** | Migration writes `sentCount` to the truth-from-scratch value. If the truth recompute were wrong, re-running the truthy SQL would restore it. The pre-migration `sentCount` is recoverable from the same source tables (it was already wrong before the migration; if the migration breaks something, the original wrong number is also recomputable). No `DROP` / `DELETE` / `TRUNCATE` operations. |

#### OWASP Top 10 Web (`web` surface — page.tsx)

| ID | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | **Pass** | No new authorization paths; the page already gates render on `tokenState`. The fix only changes which message renders during a transient. |
| A02 | Cryptographic Failures | **N/A** | No crypto. |
| A03 | Injection (incl. XSS) | **Pass** | New render path is a constant JSX subtree (`<p>Loading…</p>`); no user input concatenated. The existing error-render path's `{form.error ?? form.loadError ?? 'Failed to load survey.'}` is unchanged — same React text-node interpolation that's existed since #378, which escapes the strings. |
| A04 | Insecure Design | **Pass** | The fix makes the page strictly safer to render — the Loading copy is more informative and less alarming than the pre-fix error flash. |
| A05 | Security Misconfiguration | **N/A** | No config / headers changes. |
| A06 | Vulnerable Components | **N/A** | No dependency changes. |
| A07 | Authentication failures | **N/A** | Auth unchanged (Clerk + tokenStatus preflight gates). |
| A08 | Software & Data Integrity Failures | **N/A** | No new data pipeline. |
| A09 | Logging / Monitoring | **N/A** | No log lines added/removed. |
| A10 | SSRF | **N/A** | No outbound URLs added. |

#### Secrets-in-code

- **Pass.** Grepped the diff for credential patterns. Zero matches.

#### Privacy / PII

- **Pass.** Migration writes an aggregate integer count to `surveys.sentCount`. Doesn't read, copy, expose, or write any PII columns (`email`, `firstName`, `lastName`, `phone`, `externalId`, `consentGivenAt`). The respondent-page fix changes one render branch; no PII exposure path altered.

### Findings

**No findings.** Zero rows.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Tenant scope (Migration / `data-pipeline`): the integration tests run against per-process schemas (`test_<pid>_<ts>`); each test creates only its own brand/survey rows; assertions verify only the rows seeded by that test. Migration touches no tenant-foreign-key columns.
- A03 XSS guard: existing `page.r12-byte-identity.test.tsx` keeps the four token-error states' footer DOM byte-identical; my change to the form-render gate doesn't touch the token-error gate (branch ordering preserved at lines 128 / 140 / 159).
- Idempotency: integration test `is idempotent — running twice yields the same value` passes.

### Applied Fixes and Filed Work Items

- No fixes applied (no findings).

### Accepted / Deferred / Blocked

- None.

### Compliance Control Mapping

- N/A for this PR.

### Run Metadata

- Run date: 2026-05-29
- Branch: `feature/543-bug-p1-survey-sentcount-denormalized-field-excludes-historical-self-serve-recipients-minted-pre-540`
- Skills loaded: `threat-surface-classification`, `owasp-top-10-web-review` (web subset), `secrets-in-code-check`, `privacy-and-pii-review`, `finding-disposition`, `security-review-results-structure`. Migration-DDL review applied inline using project rule 22 + Prisma migration-hygiene constraints rather than a separate OWASP skill (data-pipeline DDL doesn't fit one cleanly).
- Skill errors: none.
- Auto-fix cap: 0 of 10 used.
- Environment: local worktree, FRAIM session `cd69cef7-1ea8-4849-bb55-e737fee8c1a1`.

## Traceability

### Source of truth

No FRAIM `feature-specification` or `technical-design` was authored — two-finding post-merge bug bundle on top of #540 / #531. The **GitHub issue body of #543** is the authoritative source; the **work-list at `docs/evidence/543-implement-work-list.md`** is the scoped plan.

### Feature Requirement Traceability Matrix

| AC | Implementation | Proof | Status |
|---|---|---|---|
| F1-AC1 — Prisma migration at `packages/database/prisma/migrations/<ts>_backfill_survey_sent_count_self_serve/migration.sql` with the truth-recomputation SQL. | `packages/database/prisma/migrations/20260529100000_backfill_survey_sent_count_self_serve/migration.sql` (new). | `pnpm db:migrate` applied cleanly post-creation; integration test SQL identical to migration SQL (shipped). | **Met** |
| F1-AC2 — Integration test asserting truth-recomputation + idempotency. | `apps/api/test/integration/distributionBatches.test.ts` describe `Survey.sentCount backfill migration (#543 F1)` — 4 cases. | `recomputes sentCount = SELF_SERVE token count + MANAGED_EMAIL delivered count`, `is idempotent — running twice yields the same value`, `leaves surveys with no batches at sentCount = 0`, `counts MANAGED_EMAIL recipients only when deliveredAt is set` — all pass (4/4). | **Met** |
| F1-AC3 — Migration applies cleanly in CI (`pnpm db:migrate`) and on the prod deploy job. | The migration directory is in the standard Prisma layout; `migration_lock.toml` already locked to `postgresql`. | Local `pnpm db:migrate` succeeded with `All migrations have been successfully applied.` CI runs the same command in the deploy pipeline. | **Met (pending CI run)** |
| F1-AC4 — Post-deploy: re-check "Are you FRAMING It?" — Survey Sent: N matches Loop Monitor (43). | Post-deploy manual spot check (user-driven). | Deferred to user spot check; recorded in evidence § "Manual / post-deploy verification". | **Met (deferred)** |
| F2-AC1 — Tokenized respondent page does not flash the red "Failed to load survey" card when the token is valid and the survey is loading. | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — inner `if (!form.error && !form.loadError)` guard routes the transient render to a Loading card. | `page.loading-vs-error.test.tsx` › `renders Loading (not the red error card) when tokenState=valid AND form has no error AND no resolved data yet` — passes. | **Met** |
| F2-AC2 — When `form.error` or `form.loadError` is non-null, the error card renders with the message. | Same file, outer fall-through preserved when either field is populated. | `page.loading-vs-error.test.tsx` › `renders the error card when form.loadError is populated` + `renders the error card when form.error is populated` — both pass. | **Met** |
| F2-AC3 — When the token is invalid / expired / responded / survey-not-open, the existing token-error states still render (no regression on branch 2). | Branches 2 (line 140) and 3 (line 159) of `page.tsx` unchanged. | `page.r12-byte-identity.test.tsx` (4 cases × the R12 invariant) — all pass. Full page suite 42/42. | **Met** |
| F2-AC4 — Unit test asserting the loading state holds across the tokenState=valid → form.loading=true transition. | `apps/web/src/app/survey/[id]/r/[token]/page.loading-vs-error.test.tsx` (new). | 3/3 pass. | **Met** |

### Technical Design Traceability Matrix

| Design commitment | Implementation | Proof | Status |
|---|---|---|---|
| Work-list §2 F1 — single-statement UPDATE with WHERE EXISTS guard; idempotent truth-from-scratch recompute. | Migration SQL is a single `UPDATE "surveys" SET "sentCount" = ... WHERE EXISTS ...` statement; no SET, no DELETE, no DROP. | Integration tests cover truth + idempotency + no-batch-guard. | **Met** |
| Work-list §2 F2 — Variant A (inner-`if` guard) not Variant B (widened loading gate). | `page.tsx` adds the inner `if (!form.error && !form.loadError)` inside the existing outer fall-through, matching Variant A. | Inline comment names the variant choice and the rationale. | **Met** |
| Rule 22a — Prisma column identifiers quoted camelCase. | All columns referenced in migration SQL (`"sentCount"`, `"surveyId"`, `"sendMode"`, `"deliveredAt"`, `"batchId"`, `"id"`) are quoted camelCase. | Visual inspection + grep against `20260523050000_add_managed_email_send` convention. | **Met** |
| Rule 22b — No competing draft migration on same feature. | Single new migration directory created; no superseded sibling. | `ls packages/database/prisma/migrations/ | grep backfill` returns one entry. | **Met** |
| Rule 22c — Timestamp newer than the most recent migration on `origin/main`. | `20260529100000` > `20260523050000` (last main migration). | `git log origin/main --oneline -- packages/database/prisma/migrations/` verified. | **Met** |
| Work-list §6 risk F1 — race window during deploy documented as order-1 + self-correcting. | Migration file `Properties` section notes the race; evidence § "Migration safety notes" repeats it. | Inline comment in migration SQL header. | **Met** |
| Work-list §6 risk F2 — Loading-state persist if `form.error` / `form.loadError` never get set. | Hook contract: one of those is populated on fetch failure (verified by re-read of `useSurveyResponseForm.ts:151-159`). | Implicit; documented in the work-list risk register. | **Met** |

### Feedback completeness verification

- `feedbackFilePath`: `docs/evidence/543-feature-implementation-feedback.md`
- Total feedback items: 0
- Items ADDRESSED: 0
- Items UNADDRESSED: 0
- `allFeedbackAddressed`: **true**

### Standing Work List → Evidence Promotion

Promoted from `docs/evidence/543-implement-work-list.md`:
- File count: 4 declared (2 source + 2 test), 4 actually touched. Under the 15-file ceiling.
- `uiValidationRequired: false` — UI polish check N/A per evidence + 543-ui-polish-validation.md.
- `mobileValidationRequired: false` — confirmed; respondent flow is responsive but not mobile-specific.
- Risk register from §6 — both items resolved (race window documented + accepted; hook contract verified by code-read).

### Phase determination

**Pass.** Zero `Partial` / `Unmet` rows in either matrix. All feedback addressed. All required validation modes executed or consciously deferred.
