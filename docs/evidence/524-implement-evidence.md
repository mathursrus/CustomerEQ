# Implementation Evidence — Issue #524 (Switch Member Identifier Kind, Slice 1: CUSTOMER_ID → EMAIL)

Phase: `feature-implementation`. Spec R0–R37; RFC `docs/rfcs/524-switch-member-identifier-kind.md`; mock 9 scenes.

## Validation gate (Rule 11 — all green, 2026-05-31)
| Command | Result |
|---|---|
| `pnpm build` | ✅ 12/12 packages (incl. `next build` web with lint-as-error) — 1m49s |
| `pnpm typecheck` | ✅ 20/20 |
| `pnpm lint` | ✅ 0 errors (4 pre-existing warnings in `apps/web/.../surveys/[id]/page.test.tsx`, not in scope) |
| `pnpm test:smoke` | ✅ pass (per-file isolated runner) |
| Integration (`vitest.integration.config.ts member-identifier-migration`) | ✅ 10/10 against live Postgres |

**Note on `apps/api` `redis.test.ts`:** running the *whole* api package as one `vitest` invocation (`pnpm --filter @customerEQ/api test`) shows a pre-existing failure in `src/plugins/redis.test.ts` ("redis.quit on app close"). **This is a pre-existing flake, not introduced by #524** — verified by checking out the pre-impl base commit (`3c86613`) with all #524 files removed: it fails identically. Root cause: `redis.ts` captures `QUEUE_MODE` at module-load and `vitest.config.ts` forces `singleFork: true`, so `apps/api/.env`'s `QUEUE_MODE=inline` (leaked into the unit process) makes the redis plugin decorate `null`. CI's `test:smoke` runner isolates each test file in its own process, so it does not hit this — `pnpm test:smoke` is green.

## Test coverage (P1: unit + integration; concurrency required)
- **Unit (no DB):** `migrationPreflight.test.ts` (14, R6–R12 test-first), `memberResolution.dual-key.test.ts` (6, R19/R32/R33/R35), `migrationReconciliation.test.ts` (4, R20/R21), existing `memberResolution.test.ts` extended (no assertions changed).
- **Integration (live DB):** `member-identifier-migration.test.ts` (10) — happy-path re-key + kind flip + audit (R16/R17/R25/R28); preflight blocking (R8/R11); **failure compensating-rollback** (R23) + per-member errorRows (R24); dual-key during PROCESSING + old-key telemetry (R19/R32/R33); reconciliation of a late old-key enrollment, no duplicate (R20); grace-expiry sweep → 410 deprecated + shape-reject (R35a/b); erased+soft-deleted excluded (R26); clerkUserId preserved (R36); cross-tenant 404 (R27); pre-expiry warning (R37).

## Key implementation decisions
1. **Re-key failure semantics — deliberate RFC §D deviation (FLAGGED).** RFC §D specified per-member committed transactions with *no* whole-batch rollback. That strands successfully-re-keyed members on failure (their `externalId` became email, brand kind stays CUSTOMER_ID, FAILED is not a dual-key status → old `customer_id` no longer resolves), violating spec R17/R23 ACs ("member 1 is still keyed by its customer_id"). **Implemented:** chunked *committed* re-key (preserves R18 live progress) + a **compensating rollback** on terminal failure reverting applied members to their original `externalId`/`email`. Required capturing each member's pre-migration email → added `MemberIdentifierMigrationMapping.oldEmail`. Rollback clears `appliedAt` (R24 retry re-processes) and preserves `errorReason` (R24 shows per-member errors). This is the only design satisfying R17+R18+R19+R23 together. Verified by the failure-rollback integration test.
2. **Impact preview / old-key tables omit `/v1/events`** (mock shows it; it is stale). Per RFC §M, `/v1/events` keys on the internal `Member.id` and is migration-stable, so the data-driven UI never renders it. Intentional, RFC-faithful.
3. **Shape-error status is 400, not the spec's literal 422 (R35b).** The existing `/v1/members/enroll` route returns `400` for `IDENTIFIER_SHAPE_INVALID` (pre-existing contract; existing tests assert 400). #524 keeps that and adds `410` for the new `IDENTIFIER_DEPRECATED_AFTER_MIGRATION`. The behavioral requirement (no member created, error names current kind) is met; only the status digit differs from the spec prose.
4. **Reconciliation moved to `apps/worker/`** (worker-only; cannot import from `apps/api`). Worker dispatch accepts an injected Prisma client (DI) so integration tests run the re-key against the per-test schema.
5. **Out of scope (per RFC §A):** `surveyImport.ts` EMAIL-hardcoding (A1), PHONE adapter/E.164 — untouched. Paths 5–6 (external-signal, CRM webhooks) match-only, no action (§M.5).

## Phase N/A
- `implement-repro` — N/A (feature, not bug); tests written alongside code.

## Architecture-doc follow-ups (deferred to `implement-architecture-update` / work-completion, per RFC Architecture Analysis)
1. Brand-wide admin-shell warning-banner pattern (`/usage-warnings` + banner). 2. Migration-mapping-backed dual-key resolution in `resolveOrEnrollMember`. 3. ADR for the direction-agnostic engine (`{fromKind,toKind}` adapters).
