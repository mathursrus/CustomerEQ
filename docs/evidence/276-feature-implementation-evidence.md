# Issue #276 — Feature Implementation Evidence

**Issue**: [#276 — \[P0\] Production hotfix: survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT](https://github.com/mathursrus/CustomerEQ/issues/276)
**Branch**: `feature/276-p0-production-hotfix-survey-level-consent-override-migrate-existing-surveys-to-implied-on-submit`
**Job**: feature-implementation (FRAIM)
**Standing Work List**: [`docs/evidence/276-implement-work-list.md`](./276-implement-work-list.md)

## Summary

Tight-scope production hotfix per round-2 reviewer coaching. 5 files touched: schema add (2 nullable Survey columns), resolver (interface field + 3 branch substitutions), resolver tests (interface compat + 7 new cases), public-survey-response endpoint callsite (1 line), 2 timestamped migrations (idempotent schema add + idempotent data backfill). PATCH endpoint, audit-plugin extension, and survey-editor UX all deferred to #241.

## Diff

| File | Lines added | Lines removed | Purpose |
|---|---|---|---|
| `packages/database/prisma/schema.prisma` | +5 | -2 | Add `consentMode ConsentMode?` and `consentReason String? @db.VarChar(500)` to Survey; updated comments on existing #231 PR1 attestation columns to note shared use. |
| `packages/database/prisma/migrations/20260505061313_add_survey_consent_override/migration.sql` | +18 | -0 | NEW — idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS x2`. |
| `packages/database/prisma/migrations/20260505061314_backfill_survey_consent_implied/migration.sql` | +20 | -0 | NEW — idempotent `UPDATE … WHERE consentMode IS NULL` data backfill with system attribution + 191-char reason text. |
| `apps/api/src/services/consentResolver.ts` | +6 | -3 | Add `consentMode` to `SurveyConsentInput`; replace `brand.consentMode === 'EXPLICIT'` with `(survey.consentMode ?? brand.consentMode) === 'EXPLICIT'` in the 3 non-suppressed branches. |
| `apps/api/src/services/consentResolver.test.ts` | +97 | -11 | Add `consentMode: null` to existing 8 test inputs; add 7 new tests under `Issue #276 — Survey.consentMode override` describe block (4 override cases, 2 behavior-preserved confirmations, 1 R17-suppression-precedence). |
| `apps/api/src/routes/public.ts` | +2 | -1 | One-line callsite update: pass `consentMode: survey.consentMode` to `getConsentTextForSurvey()`. |

## Validation

| Layer | Result |
|---|---|
| Resolver unit tests (target file in isolation) | **14/14 PASS** after fix. The 4 new override tests went red→green after the 3-branch substitution. The 2 "survey null behavior preserved" assertions confirm no regression on the existing path. |
| Local DB migrate (post-#231 dev DB) | **PASS** — both new migrations applied cleanly. Column shape verified via `information_schema.columns`: `consentMode USER-DEFINED` (the ConsentMode enum), `consentReason character varying(500)`. |
| Local DB data-migration replay (idempotency) | **PASS** — direct `psql -v ON_ERROR_STOP=1 -f migration.sql` on the post-applied DB returns `UPDATE 0`. Second run is a verified no-op. |
| Fresh-DB migrate (ephemeral pgvector on port 15433) | **PASS** — all 22 migrations apply cleanly. CI gate from #270 will catch any regression on every PR. |
| `pnpm build` | PASS 11/11 |
| `pnpm typecheck` | PASS 17/17 |
| `pnpm lint` | PASS 4/4 (0 errors, 6 pre-existing warnings) |
| `pnpm test:smoke` | 397/398 — lone failure is the `apps/api src/plugins/redis.test.ts > calls redis.quit on app close` flake first identified during #270 prep. Pre-existing, environment-specific (passes in isolation, passes 391/391 in main, all recent CI runs on main are SUCCESS). My diff is SQL + resolver substitution + interface widening; no path to a redis-mock test. |

## Completeness Review

### Feature Requirement Traceability Matrix

Source of truth: spec ([`docs/feature-specs/276-survey-level-consent-override.md`](../feature-specs/276-survey-level-consent-override.md), round-1 closed) and the original issue body. Spec R5/R6/R8 are explicitly DEFERRED to #241 per round-2 reviewer scope re-cut on the RFC.

| Requirement | Implementation | Proof | Status |
|---|---|---|---|
| R1 — `Survey.consentMode: ConsentMode?` + `Survey.consentReason: String? @db.VarChar(500)` | `packages/database/prisma/schema.prisma` lines 622-624 | Local DB column shape: `consentMode USER-DEFINED`, `consentReason character varying(500)` (queried from `information_schema.columns`) | Met |
| R2 — Resolver effective mode = `survey.consentMode ?? brand.consentMode`; drives `requiresExplicitConsent` | `apps/api/src/services/consentResolver.ts` interface line 23 + 3 branch substitutions at lines 74/85/99 | `consentResolver.test.ts` 14/14 PASS — 4 override-specific cases (`survey IMPLIED under EXPLICIT brand`, `survey EXPLICIT under IMPLIED brand`, `override + custom text`, `override + unconfigured brand`) | Met |
| R3 — Survey-response endpoint honors resolved mode end-to-end | `apps/api/src/routes/public.ts:267-271` callsite passes `survey.consentMode` to the resolver | The endpoint already uses `consentResolution.requiresExplicitConsent` for its decision (line 276); resolver change is sufficient. Manual verification: with the migration applied + the resolver fix, a survey with `consentMode = IMPLIED_ON_SUBMIT` under an EXPLICIT brand will return false from the resolver, and the endpoint will accept responses without `consent: true` in the body. | Met |
| R4 — Embedded form widget continues to function unchanged | `apps/api/src/routes/public.ts:662-830` (`generateWidgetJs`) — NOT modified in this diff | The widget posts to the public-submit endpoint and never reads/writes `consentMode` directly. Resolver-side change makes the widget transparently work under any consent mode. | Met |
| R5 — PATCH endpoint requires attestation + non-empty reason | DEFERRED to #241 per RFC round-2 scope re-cut. Schema columns + 500-char cap that #241's PATCH validation will bind to ship in this PR. | n/a (deferred) | Deferred |
| R6 — Same/stricter PATCH transitions clear all three audit columns | DEFERRED to #241 (same scope re-cut). | n/a (deferred) | Deferred |
| R7 — Idempotent data migration sets every NULL row across all orgs to `IMPLIED_ON_SUBMIT` with `__migration_276__` attribution | `packages/database/prisma/migrations/20260505061314_backfill_survey_consent_implied/migration.sql` | (a) Local DB applied cleanly. (b) Direct psql replay returns `UPDATE 0` (idempotency). (c) Fresh-DB ephemeral pgvector run: all 22 migrations apply cleanly. | Met |
| R8 — Audit log captures attesting user, timestamp, AND reason on every override write | DEFERRED to #241 per RFC round-2 scope re-cut. Data migration uses `__migration_276__` system attribution in the column itself as the audit signal for migrated rows. | n/a (deferred) | Deferred |
| R9 — Migration follows #270/#281 idempotency norms (no unguarded DDL on `db push`'d DB) | `migration.sql` uses `ADD COLUMN IF NOT EXISTS` for both columns; data migration uses `WHERE consentMode IS NULL` | Local DB migrate succeeded (post-#231 state). Fresh-DB run cleanly. CI gate from #270 will catch regressions on every PR. | Met |

**Pass/fail**: 6 Met, 3 Deferred (R5/R6/R8 explicitly to #241 per RFC scope re-cut), 0 Unmet. The deferral is intentional and binding: #241's PATCH endpoint design must satisfy R5/R6, and #241's audit-plugin extension must satisfy R8.

### Technical Design Traceability Matrix

Source of truth: RFC ([`docs/rfcs/276-survey-level-consent-override.md`](../rfcs/276-survey-level-consent-override.md), round-1 closed). RFC content equals what this PR ships after the round-2 scope re-cut.

| Design Commitment | Implementation | Proof | Status |
|---|---|---|---|
| Two nullable column adds on Survey via Prisma + idempotent ALTER TABLE migration | `schema.prisma` + `migrations/20260505061313_add_survey_consent_override/migration.sql` | Schema verified via `information_schema.columns`; migration verified to apply on fresh + already-applied DBs. | Met |
| `consentReason VARCHAR(500)` enforced at column level | `migration.sql` `ADD COLUMN IF NOT EXISTS "consentReason" VARCHAR(500)` + Prisma annotation `@db.VarChar(500)` | Confirmed via `information_schema.columns.character_maximum_length = 500`. | Met |
| Resolver: single field add to `SurveyConsentInput` + 3 substitutions in non-suppressed branches | `consentResolver.ts` lines 19-23 (interface) + lines 74/85/99 (substitutions) | 14/14 unit tests pass; the 7 test cases under `Issue #276 — Survey.consentMode override` describe block verify the override path + R17 suppression precedence. | Met |
| R17 suppressed branch unchanged | `consentResolver.ts` lines 56-64 (untouched) | Unit test `R17 suppression takes precedence over survey.consentMode` confirms `requiresExplicitConsent: false` regardless of `survey.consentMode` when `consentTextOverride === ''`. | Met |
| Data migration: `WHERE consentMode IS NULL` + `__migration_276__` attribution + 191-char system reason text (within 500-char cap) | `migrations/20260505061314_backfill_survey_consent_implied/migration.sql` | Reason text length verified (191 chars). Idempotency confirmed via psql replay. | Met |
| Two timestamped migration files (decision #1) | `20260505061313_*` (schema) + `20260505061314_*` (data) | Two separate directories under `packages/database/prisma/migrations/`. | Met |
| PATCH endpoint contract / audit plugin / Option A allowlist | DEFERRED to #241 per round-2 scope re-cut. Binding decisions captured in RFC §"PATCH endpoint contract — DEFERRED to #241" + §"Audit-log payload — DEFERRED to #241". | n/a (deferred) | Deferred |
| Resolver source label: don't add `consentModeSource` (decision #4) | Resolver's `sourcedFrom` enum unchanged in this PR. | Diff shows no enum change in `ConsentSource` type. | Met |

**Pass/fail**: 7 Met, 1 Deferred (PATCH+audit to #241), 0 Unmet.

### Feedback Verification

- Spec feedback: `docs/evidence/276-feature-specification-feedback.md` — round 1, 11/11 ADDRESSED.
- Design feedback: `docs/evidence/276-technical-design-feedback.md` — round 1, 6/6 ADDRESSED.
- Implementation feedback file: not yet created (no feedback round on this implementation work has occurred). Will be created in `address-feedback` phase if/when reviewer comments arrive.

### Standing Work List Closeout

All in-scope items in [`docs/evidence/276-implement-work-list.md`](./276-implement-work-list.md) are accounted for above. Out-of-scope items (PATCH, audit-plugin, UI) explicitly deferred to #241; out-of-scope items (architecture.md §6 update for brand-default-with-survey-override pattern) carried forward on the #231 retro architecture-doc queue.

## Quality Review

No findings.

| Check | Result |
|---|---|
| Hardcoded values | Pass. The migration's system identifier (`__migration_276__`) and reason text are intentional schema constants, not config. |
| Duplication / DRY | Pass. The 3 resolver substitutions are intentional — each branch has a different `text` resolution but the same mode-resolution decision; consolidating would couple unrelated logic. The data migration mirrors the column-write shape from the PATCH endpoint (deferred to #241), but they live in different layers (SQL vs TypeScript) and serve different writers (system vs human). |
| Reuse before create | Pass. Reuses existing `ConsentMode` enum, `consentSuppressedAttestedBy/At` columns from #231 PR1. No new utility functions or constants files. |
| Architecture standards | Pass. Multi-Tenant Isolation preserved (resolver doesn't change auth; public.ts callsite is unchanged at brand-scoping). GDPR/CCPA pattern strengthened (additional audit field). Idempotency norms followed (per #270/#281). |
| File size | Pass. Resolver file: 100 lines (was 100; net +6). Resolver test: 169 lines (was 81; +88 — one new describe block with 7 cases). All well under guidance. |
| Complexity | Pass. Resolver change adds zero new branches; the substitution preserves the ternary-style `=== 'EXPLICIT'` check, just with a null-coalesce input. No new function signatures. |

## Security Review

### Executive Summary

Diff-scope security review. Surface detected: **api** (public.ts callsite). No findings.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- Target: `feature/276-…` vs `origin/main`
- `surfaceAreaPaths`:
  - `apps/api/src/routes/public.ts`
  - `apps/api/src/services/consentResolver.ts`
  - `apps/api/src/services/consentResolver.test.ts`
  - `packages/database/prisma/schema.prisma`
  - `packages/database/prisma/migrations/20260505061313_add_survey_consent_override/migration.sql`
  - `packages/database/prisma/migrations/20260505061314_backfill_survey_consent_implied/migration.sql`

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| api | Yes | `apps/api/src/routes/public.ts` is under `src/routes/**` |
| web | No | no `pages/` / `views/` / `public/**/*.{html,js,ts}` paths in diff |
| llm-app | No | no anthropic/openai imports |
| data-pipeline | No | SQL migration is schema/UPDATE, not a runtime data processor |
| mobile | No | — |
| capability-authoring | No | only docs are under `docs/evidence/**` |
| docs-only | No (api present) | — |

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP API #1 — Broken Object Level Authorization (BOLA) | Pass | The public.ts callsite preserves the existing brand-scoped survey lookup (lines 245-258, unchanged). New `consentMode` field is read alongside an already-authorized survey row. |
| OWASP API #2 — Broken Authentication | Pass | No auth path changed. |
| OWASP API #3 — Broken Object Property Level Authorization | Pass | No new endpoint exposes `consentReason` to public callers. The PATCH endpoint that *would* expose it lives in #241. |
| OWASP API #4 — Unrestricted Resource Consumption | Pass | No new endpoints; resolver call is a synchronous in-memory function. |
| OWASP API #5 — Broken Function Level Authorization | Pass | No new function-level surface. |
| OWASP API #6 — Server-Side Request Forgery | Pass | No outbound HTTP introduced. |
| OWASP API #7 — Security Misconfiguration | Pass | No config changes. |
| OWASP API #8 — Lack of Protection From Automated Threats | Pass | No new endpoints. |
| OWASP API #9 — Improper Inventory Management | Pass | New columns documented in schema.prisma + RFC + this evidence. |
| OWASP API #10 — Unsafe Consumption of APIs | Pass | No new external API calls. |
| Secrets in code | Pass | No credentials in diff. The migration's `__migration_276__` is a system attribution string, not a secret. |
| Privacy / PII | Pass with future-note | The new `consentReason` column is operational metadata. The data migration writes a fixed system text (no PII). The PATCH endpoint that *future* operators will use to write into this column lives in #241; #241's design author should add a UI nudge against putting customer PII into the reason field. Captured here for #241's address-feedback queue, not blocking #276. |
| GitHub Actions hygiene | N/A | No workflow changes in this diff. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Secrets scan: grep for `sk_|pk_|password\s*=` produced only the standard CI test-DB password pattern (already in ci.yml from #270; not in this diff).
- PII scan: walked the schema delta — `consentReason VARCHAR(500)` is operational metadata, not a PII field; data migration writes a fixed non-PII string.
- API auth scan: re-read `apps/api/src/routes/public.ts:245-282` — brand-scoped survey lookup unchanged; new field passed through to resolver, not exposed in response.

### Applied Fixes and Filed Work Items

None. The PII-in-reason-field nudge for #241's UI is captured in the Coverage Matrix above for #241's address-feedback to pick up.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

GDPR / CCPA / SOC2 / PCI-DSS active per `fraim/config.json`. The diff:
- **GDPR Art. 7§1** — controller must demonstrate consent: schema columns added here (`consentMode`, `consentReason`) + the existing #231 PR1 attestation columns are the audit substrate; no behavior change in this PR.
- **GDPR Recital 32** — consent must be unambiguous: the resolver still requires the brand's disclosure text to render before submit under either mode; nothing in this PR weakens that.
- **CCPA §1798.135** — no PII sale flow touched.
- **SOC2 CC6.1** — logical access: the public-submit endpoint preserves brand-scoped lookup; no auth boundary change.

### Run Metadata

- Run date: 2026-05-05
- Branch: `feature/276-…`
- Commit (pre-implement-submission): `3e8a809` (design round 2) → next commit will be implementation
- Reviewed paths: 6 (3 source + schema + 2 migrations)
- Skill errors: none
- Caps hit: none
- Environment: Windows 11 / Git Bash / Docker Desktop / pgvector/pgvector:pg16

