# Feature Implementation Evidence — Issue #524 (Switch Member Identifier Kind, Slice 1)

See `524-implement-evidence.md` for the Rule 11 gate results, test inventory, and key decisions. This file records the implement-validate bug bash.

## Validation summary
- Build: ✅ `pnpm build` 12/12. Typecheck: ✅ 20/20. Lint: ✅ 0 errors. `test:smoke`: ✅. Integration: ✅ 10/10 (live Postgres).
- Code hygiene: no `console.log` / TODO / FIXME / placeholder in #524 source; clean working tree.
- UI baseline: `524-ui-polish-validation.md` (no P0/P1).

## Bug Bash Findings

Edge-case, boundary, and adjacent-flow exploration (code-level + integration-backed), since the Clerk-authed UI is the user's live functional pass.

| ID | Severity | Area | Finding | Disposition |
|---|---|---|---|---|
| B-1 | High → fixed (pre-validate) | worker | RFC §D's no-rollback failure path would strand re-keyed members on failure (violates R23). | Fixed in implement-code: compensating rollback + `mapping.oldEmail`; covered by the failure-rollback integration test. |
| B-2 | Low → fixed | web | `[id]` page polled terminal migrations forever. | Fixed: status-derived `enabled`. |
| B-3 | Info | api | Empty / malformed / wrong-column CSV upload → `422 CSV_PARSE_ERROR`; nothing written (R6). | Verified in `parseMappingCsv` unit tests + route guard. |
| B-4 | Info | api | Second migration while one is active → `409 MIGRATION_ALREADY_IN_PROGRESS` with `redirectTo`; wizard redirects. | Verified (route guard + UI `MigrationInProgressError`). |
| B-5 | Info | api | Non-CUSTOMER_ID brand creating a migration → `400 UNSUPPORTED_MIGRATION_DIRECTION`. | Verified (route guard). |
| B-6 | Info | api | `extend-grace` outside grace → `409 NO_ACTIVE_GRACE`; `cancel` after PROCESSING → `409 MIGRATION_NOT_CANCELLABLE`; `start` without attestation → `422`. | Verified (route guards). |
| B-7 | Info | worker | Crash mid-batch is resumable — the re-key cursor only selects `appliedAt IS NULL AND errorReason IS NULL`, so a restart continues where it stopped (idempotent). | By design; not separately reproduced (would need a forced crash). |
| B-8 | Info | api | Grace-expiry sweep handles multiple due migrations in one pass; request-time R35 rejection gates on `status`, not `now()`, so ≤15-min sweep lag is safe. | Verified (grace-expiry integration test). |
| B-9 | Info | engine | Dual-key fallback fires only on a primary-lookup MISS and only when an active migration exists → hero `/v1/events` path (internal-id) pays nothing. | By design (§E/§M.2); dual-key path covered by the PROCESSING integration test. |

**Result: 0 Critical/High bugs open after edge-case, boundary, and adjacent-flow exploration** (B-1 was found and fixed in implement-code; B-2 fixed in implement-validate). Phase not blocked.

## Security Review

### Executive Summary
Diff-scoped review of the #524 implementation. **1 finding fixed (Low — CSV formula injection), 0 Critical/High/Medium open.** No escalations. Phase passes.

### Review Scope
`reviewType=embedded-diff-review`, `reviewScope=diff` (branch vs `main`). Surfaces reviewed: API routes (`adminBrandMigrations.ts`, `members.ts`, `public.ts`, `distributionBatches.ts`, `admin-brand-profile.ts`), worker (`memberIdentifierMigration.ts`, `migrationReconciliation.ts`), web (`migrations/**`, `MemberIdentificationSection.tsx`, `UsageWarningBanner.tsx`, `lib/migrations.ts`), schema/migration. Referenced-not-reviewed: unchanged auth/clerk plumbing.

### Threat Surface Summary
- **api** — `apps/api/src/routes/adminBrandMigrations.ts` (8 admin endpoints) + ingress edits to 3 existing routes.
- **web** — admin wizard + status pages + banner under `apps/web/src/app/(admin)/.../migrations/**`.
- **capability-authoring** — `docs/retrospectives/...-design-postmortem.md` (benign narrative; no agent-instruction/prompt-injection content).
- Not present: llm-app, mobile, data-pipeline (worker uses Prisma ORM, no raw driver).

### Coverage Matrix
| Category | Result |
|---|---|
| API01 Broken Object-Level Auth (BOLA/IDOR) | Pass — all routes scope by `request.brandId`; `loadOwnedMigration` enforces `{id, brandId}` (cross-tenant 404 tested). |
| API02 Broken Authentication | Pass — admin routes behind the auth plugin; no auth code changed. |
| API03 Broken Object Property / Mass Assignment | Pass — `brandId`/`fromKind`/`toKind` server-set; body never supplies tenant/identity. |
| API03 Injection (SQL/CSV) | **Fail→Fixed** — Prisma parameterized (no raw SQL); CSV template export hardened against formula injection. |
| API04 Unrestricted Resource Consumption | N/A→Accept — re-key is async (worker); preflight loads members in-memory (admin-only, documented perf note). |
| API05 Broken Function-Level Auth | Pass — all mutations admin-scoped + audited. |
| Web A03 XSS | Pass — React-escaped; no `dangerouslySetInnerHTML`; CSV download via Blob. |
| Web A05 Security Misconfig | Pass — no new external links / `target=_blank`; no client secrets. |
| Secrets-in-code | Pass — none introduced. |
| Privacy / PII | Pass — erased/soft-deleted excluded from re-key (cannot re-PII an erased member; tested); attestation captures lawful basis; logs carry cuids + Prisma field names, not PII values; `errorRows`/audit visible only to the owning brand admin. |

### Findings
| ID | Severity | Class | Location | Summary | Disposition |
|---|---|---|---|---|---|
| SEC-1 | Low | CSV/Formula injection (API03) | `adminBrandMigrations.ts:csvCell` | Mapping-template export wrote brand-supplied `customer_id`/`email` cells without neutralizing leading `= + - @`; opening in Excel could execute. | fix (auto) |

### Prioritized Remediation Queue
1. SEC-1 — fixed inline (prefix `'` on formula-leading cells before quoting). No remaining queue.

### Verification Evidence
- SEC-1: fix at `csvCell` prefixes a single quote for cells matching `/^[=+\-@\t\r]/`; api typecheck green; commit `5199ef2`.

### Applied Fixes and Filed Work Items
- `5199ef2` — `security(API03/CSV-INJECTION): neutralize formula-injection in mapping-template export`.

### Accepted / Deferred / Blocked
- Preflight/impact-preview in-memory aggregation on very large brands — accepted for Slice 1 (admin-only, RFC Confidence-Level notes a 30s cache mitigation if adoption grows). Owner: future perf issue if needed.

### Compliance Control Mapping
No formal regulations configured in `fraim/config.json`. Project Rule 13 (GDPR/CCPA): erasure preserved (R26, tested), lawful-basis attestation captured (R13), auditability (R25) — all satisfied.

### Run Metadata
- Date: 2026-05-31. Commit at review: `5199ef2`. Auto-fix cap: 1/10 used. Skill errors: none. Environment: local diff review against `main`.

## Regression (`pnpm test`, full monorepo)
Run 2026-05-31. **15/18 turbo tasks pass; the only test failure is pre-existing and unrelated to #524.**
- Green: `shared` 726, `worker` 184 (incl. moved reconciliation), `web` (all incl. new migration UI tests via build), `connectors` 42, `consent-text` 69, `ui` 7, `mcp-server` 8, `database` 2, and `api` 572/573.
- **1 failure — `apps/api src/plugins/redis.test.ts > calls redis.quit on app close`.** Triage:
  - *Classification:* pre-existing test-isolation/environment defect, **not a #524 regression**.
  - *Root cause:* `redis.ts` captures `QUEUE_MODE` at module-load; `apps/api/.env`'s `QUEUE_MODE=inline` leaks into the unit-test process; `vitest.config.ts` forces `singleFork`, so the cached redis-plugin module decorates `redis=null`, breaking the test's mocked-ioredis assumption.
  - *Proof:* checked out base commit `3c86613` (pre-#524, my files removed) → fails identically (1 failed | 552 passed). Independent of this issue.
  - *Why CI is green:* the CI gate `pnpm test:smoke` (`scripts/test-suite-runner.mjs`) isolates each test file in its own process, so the singleFork cross-file env leak never occurs; `pnpm test:smoke` passed this run.
  - *Disposition:* **not fixed on this branch** — the fix (read `QUEUE_MODE` at plugin-invocation rather than module-load) is an unrelated cross-cutting change to a non-#524 file (Rule 21 / Rule 25c). Recommend a separate dev-environment issue. #524 introduces no new regressions.

## Completeness Review

Test name keys: **IT** = `member-identifier-migration.test.ts` (integration, 14 tests); **UT-preflight/dualkey/recon** = the named unit suites; **UI** = component + `next build` + UI baseline (`524-ui-polish-validation.md`); live Clerk click-through = user functional pass.

### Feature Requirement Traceability Matrix
| Requirement | Implemented (file/fn) | Proof | Status |
|---|---|---|---|
| R0 direction-agnostic engine | schema `fromKind/toKind`; worker reads `migration.toKind` | IT happy-path | Met |
| R1 "Switch" action when CUSTOMER_ID + members | `MemberIdentificationSection.LockedPanel` | UI + `current` endpoint | Met |
| R2 radios non-editable; guided flow only | section radios disabled; PATCH rejects toggle w/ redirect | UI + code guard | Met |
| R3 only EMAIL selectable | wizard radios (Phone disabled); `POST /migrations` 400 non-CUSTOMER_ID | IT create-guard + UI | Met |
| R4 downloadable template pre-filled | `GET mapping-template.csv` + `buildFastPathRows` | IT "downloads a mapping template pre-filled" | Met |
| R5 accept CSV upload scoped to brand | `POST /:id/mapping` (text/csv) | IT "blocks…CSV omits a member" | Met |
| R6 validation before any write | `validatePreflight` (pure); persist only on ok | UT-preflight + IT (PENDING after fail) | Met |
| R7 report counts | `MigrationPreflightResult.counts` | UT-preflight | Met |
| R8 unmapped → blocking | coverage check | UT-preflight + IT | Met |
| R9 collision → blocking | collision check | UT-preflight | Met |
| R10 invalid shape → blocking | `EMAIL_RE` | UT-preflight | Met |
| R11 not startable while blocking | advance only on ok | IT (PENDING after unmapped) | Met |
| R12 per-row detail | `rowIssues[]` | UT-preflight + UI error table | Met |
| R13 attestation recorded | start writes audit `…started` w/ admin+text+ts | IT "persists the attestation text…" | Met |
| R14 migrate disabled until attestation | wizard checkbox gate; `StartSchema` 422 w/o | UI + zod guard | Met |
| R15 async off hot path | BullMQ worker | code | Met |
| R16 re-key externalId+email in brand tx | worker | IT happy (externalId==email) | Met |
| R17 flip only on terminal success | worker final tx; failure never flips | IT happy + IT rollback | Met |
| R18 live progress | committed-chunk counters + poll panel | IT (processedMembers) + UI | Met |
| R19 dual-key during re-key | resolver fallback | UT-dualkey + IT PROCESSING | Met |
| R20 reconcile late old-key enrol | `reconcileMigration` | UT-recon + IT reconcile | Met |
| R21 LWW, no hard-delete | reconcile create-only | UT-recon | Met |
| R22 completion summary counts | `reconciledMembers` + UI summary | IT reconcile (count>=1) + UI | Met |
| R23 failure rollback, members on original key | `rollbackAppliedMembers` | IT rollback | Met |
| R24 per-member errors + retry | `errorRows` + `MigrationFailedPanel` + start-from-FAILED | IT rollback (errorRows>=1) | Met |
| R25 audit before/after+counts+attestation | worker+route audits | IT completed/started/extend | Met |
| R26 preserve attrs; exclude erased | UPDATE-only; erased/deletedAt excluded | IT erased-excluded + IT clerkUserId | Met |
| R27 tenant-scoped | `request.brandId` + `loadOwnedMigration` | IT cross-tenant 404 | Met |
| R28 fast path | `preflight-context.fastPathAvailable` | IT happy + UT | Met |
| R29 fast-path unavailable → upload | false branch | UT-preflight + UI | Met |
| R30 data-driven impact preview, omit /v1/events | `buildImpactPreview` | IT "never lists /v1/events" | Met |
| R31 30-day grace | worker `graceExpiresAt=+30d` | IT happy | Met |
| R32 dual-key during grace | resolver grace status | UT-dualkey + IT | Met |
| R33 old-key telemetry per ingress | `recordOldKeyUsage` | IT PROCESSING (usage count) | Met |
| R34 grace panel + extend (no attestation) | `GraceStatusPanel` + `POST /:id/extend-grace` | IT "extends the grace window…" | Met |
| R35 post-grace 410 / reject | resolver post-grace branch | IT "rejects an old id after grace" + UT-dualkey | Met (shape-error 400 per existing route contract vs spec-prose 422 — see Decisions) |
| R36 loyalty-only; clerkUserId preserved | coverage over Member rows | IT clerkUserId + IT erased totals | Met |
| R37 pre-expiry banner | `GET /usage-warnings` + `UsageWarningBanner` | IT pre-expiry + UI | Met |

**Feature-requirement matrix: PASS — 0 Unmet/Partial.**

### Technical Design Traceability Matrix
| Design commitment (RFC) | Implemented | Proof | Status |
|---|---|---|---|
| §A direction-agnostic adapters | `fromKind/toKind` drive worker sidecar | IT happy | Met |
| §A out-of-scope: surveyImport A1, PHONE untouched | not modified | diff (no surveyImport change) | Met (deferral) |
| §B 3 tables + `Brand.activeMigrationId` | migration `20260531000000` | `migrate status` clean | Met |
| §B (added) `mapping.oldEmail` for rollback | schema + migration | IT rollback | Met (deviation, documented) |
| §C 8 endpoints (+`/current` for UI) | `adminBrandMigrations.ts` | IT suite | Met |
| §C.1 preflight contract | `MigrationPreflightResult` | UT-preflight | Met |
| §C.2 fast-path detect (JS not raw SQL) | preflight-context JS aggregation | IT happy | Met (deviation documented) |
| §D re-key worker | `dispatchMemberIdentifierMigration` | IT happy + IT rollback | Met (failure=compensating rollback, deviation documented) |
| §E dual-key resolution | resolver fallback | UT-dualkey + IT | Met |
| §F reconciliation (record, no merge) | `reconcileMigration` | UT-recon + IT | Met (phantom-merge deferred per RFC) |
| §G grace + sweep + pre-expiry | `dispatchGraceExpirySweep` + usage-warnings | IT grace + IT pre-expiry | Met |
| §H impact preview (omit /v1/events) | `buildImpactPreview` | IT impact-preview | Met |
| §I audit family | `emitMigrationAudit` + `request.audit` | IT audits | Met |
| §J UI structure | `migrations/**` + section + banner | next build + UI baseline | Met |
| §M ingress audit (paths 1-3 only; events excluded) | 3-value enum; events untouched | IT impact-preview + events.ts unchanged | Met |
| Callout: reuse `usePollingQuery` | progress/grace/[id] panels | import + UI | Met |
| Callout: reuse consent-mode attestation pattern | wizard checkbox + `…started` audit | IT attestation | Met (pattern reused; inline checkbox per mock Scene 5) |
| Callout: mirror historical-import (#262) upload | built equivalent (file input + preflight + error table) | UI baseline | Met (#262 UI absent in repo; built to pattern intent) |
| Arch-doc additions (banner/dual-key patterns, engine ADR) | — | — | Deferred (RFC defers to architecture-update/work-completion) |

**Technical-design matrix: PASS — 0 Unmet/Partial; 0 unresolved named callouts; deviations are intentional tradeoffs (documented in Decisions).**

### Feedback Verification
- `524-design-feedback.md` (technical-design Round 1): all 3 comments ADDRESSED (`15a2159`/`3c86613`).
- `524-feature-implementation-feedback.md` (quality): Q-1 ADDRESSED (fixed); Q-2/Q-3 ADDRESSED (justified). 0 UNADDRESSED.
- No open human PR-review feedback yet (PR goes Ready only at work-completion; `address-feedback` is the hold-point).

**Completeness review: PASS.**
