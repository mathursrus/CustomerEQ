---
author: manohar.madhira@outlook.com
date: 2026-05-31
synthesized:
---

# Postmortem: Switch member identifier kind (CUSTOMER_ID→EMAIL, Slice 1) — feature-implementation — Issue #524

**Date**: 2026-05-31
**Duration**: one implementation cycle (scoping → submission → 1 user-testing feedback round)
**Objective**: Implement the approved RFC — re-key a brand's loyalty members CUSTOMER_ID→EMAIL behind a direction-agnostic engine, with pre-flight validation, dual-key catch-up, reconciliation, grace window, and an admin wizard.
**Outcome**: success — shipped end-to-end on PR #525; Rule 11 gate green; 15 integration + 27 unit/component tests; user manually verified both migration paths re-keyed members correctly; 4 user-testing findings (F1–F4) fixed on-branch with regression tests.

## Executive Summary
The engine, worker, routes, and UI were built spec-driven and walking-skeleton-first, with the highest-risk logic (dual-key, reconciliation, compensating rollback) validated by integration tests against a live Postgres schema. The single most valuable moment was catching — during implement-code, before shipping — that the approved RFC §D failure path would *strand* re-keyed members, and fixing it with a compensating rollback. The misses were UI/runtime-integration gotchas (duplicate-create on React double-mount, file-input re-upload, an under-reporting status banner) that automated tests didn't catch but live user testing did — exactly what the manual-validation pass is for.

## Quick RCA Card
**What failed**: Four defects surfaced only in live browser testing — duplicate migration rows on wizard mount (F4), same-filename re-upload no-op (F3), Step-1 banner under-reporting issues (F1), and a missing template annotation (F2, an enhancement).
**Impact**: None reached production (caught in the manual-validation pass); the migration itself always re-keyed correctly. F4 left orphan `PENDING_VALIDATION` rows.
**What should have happened**: create-on-mount should have been idempotent + race-safe from the start; the upload input should have reset its value; the data-driven banner should have surfaced every computed signal.
**What changes next time**: treat "client effect that creates a server resource on mount" and "file input re-selection" as known-gotcha checklist items (coaching moments captured).
**Example**: two `POST /migrations` with identical `createdAt` (…51.645) → one completed, one orphaned.

## Architectural Impact
**Has Architectural Impact**: Yes
**Sections Updated**: `architecture.md` §6 (two new patterns: during-migration dual-key resolution; brand-wide admin-shell warning banner); §11 ADR table; new ADR 0005 (direction-agnostic migration engine).
**Rationale**: the engine is a one-way-door (Rule 4); the dual-key + banner patterns are reusable infrastructure flagged in the RFC.
**Updated in PR**: yes (commit `2061713`).

## Timeline of Events
### Phase: implement-code
- [done] Walking-skeleton-first: schema+migration → engine services (test-first preflight) → worker → routes → UI.
- [done] **Caught the RFC §D stranding defect before shipping**; implemented compensating rollback + `mapping.oldEmail`.
- [missed] Wizard create-on-mount written without idempotency/race-safety (F4 latent).
- [missed] Upload input written without value-reset (F3 latent).
- [missed] Step-1 partial banner surfaced only `withoutEmail`, ignoring the `collisionGroups`/`invalidShape` it already had (F1 latent).
### Phase: implement-validate → security → regression → quality → completeness
- [done] DI-refactored the worker so the re-key runs against the per-test schema; 14→15 integration tests.
- [done] Security: caught + fixed a CSV formula-injection in the template export.
- [done] Quality: consolidated the canonical-key normalization (DRY, `normalizeExternalId`).
### Phase: address-feedback (user testing)
- [done] Logged F1–F4 silently during the user's pass; batch-fixed on signal with regression tests; full gate re-run green.

## Root Cause Analysis
### 1. Primary cause — duplicate migration on wizard mount (F4)
**Problem**: The wizard issues `POST /migrations` in a mount effect; React 18 dev strict-mode double-invokes the effect, firing two creates. The server's "one active migration per brand" guard was a read-then-insert (`findFirst` active → none → `create`), so both requests passed and inserted two rows (TOCTOU race).
**What drove it**: The RFC §B.4 explicitly chose *not* to use a Postgres partial-unique constraint, stating "the application-layer guard plus `Brand.activeMigrationId` is simpler and sufficient." I implemented exactly that — but "sufficient" was wrong: a read-then-insert guard is not race-safe, and a create-on-mount effect is a concurrent caller in dev by default.
**Corpus/RFC conflict**: **Yes — RFC §B.4's "app-layer guard is sufficient" is the conflicting guidance.** It under-specified concurrency. Corrected in-impl with a brand-row `FOR UPDATE` lock + idempotent reuse; ADR 0005 now records the engine's create as race-safe.
**Impact**: orphan `PENDING_VALIDATION` rows (cosmetic; migration unaffected).

### 2. Contributing — file input re-upload no-op (F3)
**Problem**: Re-uploading a corrected file with the same filename didn't re-validate (browsers suppress `change` when the selected file is unchanged).
**What drove it**: A well-known HTML file-input gotcha I did not account for when writing the upload handler — no specific corpus entry; a reasoning/coverage gap (I tested the happy upload, not the re-upload-same-name path).
**Impact**: user had to rename the file to proceed.

### 3. Contributing — Step-1 banner under-reported (F1)
**Problem**: The partial-coverage banner showed only the missing-email count, though `preflight-context` already returned `collisionGroups` and `invalidShape`.
**What drove it**: I mirrored the mock's Scene-2B copy ("partial coverage — N of M have email") literally instead of surfacing every computed signal. Reasoning gap: treated the banner as a coverage indicator, not a complete issue summary.
**Impact**: iterative fix-one-then-discover-next UX.

## What Went Wrong
1. Three latent UI/runtime defects (F1/F3/F4) that unit + integration tests didn't exercise but live browser use did.
2. Accepted the RFC's "app-layer guard is sufficient" without stress-testing concurrency.

## What Went Right
1. **Caught the RFC §D stranding bug pre-ship** and fixed it correctly (compensating rollback) — the highest-value catch.
2. **DI refactor** of the worker enabled real integration tests of the re-key/rollback against a live schema.
3. **Security + quality passes added value** (CSV-injection fix, DRY normalization) rather than being rubber-stamps.
4. **Silent-capture during user testing** (per the user's standing instruction) kept the session clean; batch-fix with regression tests for all four.
5. **Full traceability** (R0–R37 + RFC §A–§M) all test-backed.

## What I Almost Did Wrong But Caught
1. Almost implemented RFC §D's per-member-no-rollback verbatim, which would have stranded re-keyed members on failure. Signal: tracing the FAILED status against the dual-key status set showed the stranded-member window. Fixed with compensating rollback before any commit shipped it.

## Where Past Learnings Actually Fired
1. **`feedback_always_open_html_mocks`** — read all 9 scenes before building; every affordance landed (wizard, panels, banner).
2. **`feedback_log_findings_batch_fix_during_user_testing`** — stayed silent-capture through F1–F4, batch-fixed on `batch-go`.
3. **`feedback_validate_phase_must_run_build`** — ran full `pnpm build` (not just typecheck) at validate + after fixes; `next build` lint-as-error caught nothing because I lint-gated each change.
4. **`reference_member_ingress_paths`** — the §M ingress model (which paths honor kind) drove the dual-key surface + the `/v1/events` exclusion that held up under user questioning.

## Lessons Learned
1. **A client effect that creates a server resource on mount must be idempotent AND the server must be race-safe** (row-lock or DB constraint), because React strict-mode (dev) and retries make it a concurrent caller. "App-layer read-then-insert guard" is not sufficient.
2. **File inputs need their `value` reset on change** so re-selecting the same filename re-fires `change`.
3. **Data-driven status surfaces should render every computed signal**, not the one the mock copy happened to mention.

## Agent Rule Updates Made to avoid recurrence
1. Coaching moments captured: `idempotent-race-safe-create-on-mount`, `reset-file-input-value-for-reupload`.

## Enforcement Updates Made to avoid recurrence
1. Regression tests now lock in all four fixes (2 wizard component tests + 2 integration assertions) so they can't silently regress.
2. ADR 0005 records the create path as race-safe, correcting the RFC §B.4 "sufficient" guidance for future lanes.
