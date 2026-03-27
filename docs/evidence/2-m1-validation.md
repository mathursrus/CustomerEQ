# M1 Validation Evidence — Issue #2: Configure Loyalty Program

**Milestone**: M1 — Backend Foundation
**Date**: 2026-03-27
**Commit**: `e078d5b`
**Branch**: `feature/2-issue-2`

---

## Validation Requirements (from work list)

- `uiValidationRequired`: No (API only)
- `mobileValidationRequired`: No
- Manual: `curl` test all new endpoints with `X-Test-Brand-Id` header ⚠️ (requires running DB — see below)
- Run: `pnpm test` (no regressions), `pnpm typecheck`

---

## 1. Working Tree

```
git status --short
?? .claude/settings.local.json   ← local Claude config, not committed
```

Clean — all M1 implementation committed in `e078d5b`.

---

## 2. TypeCheck

```
pnpm typecheck
Tasks: 10 successful, 10 total
Time:  16.289s
```

**Result: ✅ PASS — 0 errors across all 10 packages**

Two pre-existing type errors also fixed as part of this work:
- `apps/api/src/routes/public.ts:216` — `job.id` assigned to `string | null` (fixed `?? null`)
- `apps/api/src/routes/surveys.ts:237` — same pattern (fixed `?? null`)

---

## 3. Unit Tests

### Worker (`@customerEQ/worker`)

```
pnpm --filter @customerEQ/worker test

Test Files: 3 passed (3)
     Tests: 87 passed (87)
  Duration: 3.04s
```

New tests added (all passing):
- `evaluateConditions` — 16 cases (AND/OR, null, numeric ops, missing field)
- `evaluateRulesWithIds` — 15 cases (priority ordering, stackable, per-rule budget cap, program budget cap, conditions integration)

### Shared Schemas (`@customerEQ/shared`)

```
pnpm --filter @customerEQ/shared test

Test Files: 5 passed (5)
     Tests: 140 passed (140)
  Duration: 1.09s
```

New tests added (all passing):
- `CreateProgramSchema` M1 additions — 7 cases (type enum, budget fields, haltBehavior, alertThresholdPct)
- `UpdateProgramStatusSchema` — 5 cases
- `SimulateSchema` — 5 cases
- `CreateTierSchema` — 8 cases
- `UpdateTierSchema` — 3 cases
- `CreateRewardSchema` — 8 cases
- `RetireRewardSchema` — 3 cases

**Total unit tests: ✅ 227/227 PASSING**

---

## 4. Integration Tests

Integration tests (`apps/api/test/integration/programs.test.ts`) require a running PostgreSQL instance.

**Status: ⚠️ PENDING** — Docker is not available in this shell environment.

To run integration tests once Docker/DB is available:
```bash
# 1. Start services
docker compose up -d postgres

# 2. Generate migration
pnpm db:migrate:new --name m1-configure-loyalty-program

# 3. Run integration tests
pnpm --filter @customerEQ/api test:integration
```

Tests written and ready (60+ test cases):
- GET /v1/programs — pagination envelope, filters (status, type), tenant isolation
- PUT /v1/programs/:id/status — transitions, activation guard (422 if no rules)
- Tier CRUD — POST (201), GET sorted by rank, DELETE soft-delete, 409 blocked by members
- Reward retire — immediate + scheduled (expireAt)
- POST /v1/programs/:id/simulate — rulesMatched, totalPoints, non-mutating verified
- POST/GET /v1/programs/:id/versions — snapshot creation + list
- Campaigns/surveys GET — updated to assert pagination envelope

---

## 5. No-Regression Check

Existing tests that were passing before M1:
- `evaluateRules` describe block — all 25 existing tests still pass (all-fire behavior preserved)
- `CreateProgramSchema` / `UpdateProgramSchema` — all 15 existing tests still pass
- Campaign schema tests — 25 tests pass
- Event, member, survey schema tests — 54 tests pass

**Result: ✅ Zero regressions**

---

## 6. Code Quality Checklist

- [x] No `console.log` in committed code
- [x] No `TODO` / `FIXME` in committed code (RFC Issue #4 reference is a code comment, not a TODO marker)
- [x] `pnpm typecheck` passes (zero errors)
- [x] `pnpm test` passes for unit tests (227/227)
- [x] `brandId` never accepted from request body — all new routes use `request.brandId` from JWT
- [x] All new mutations emit audit events (program.create, program.status_change, tier.create, tier.delete, reward.retire, program.version_create)
- [x] All new DB columns have defaults or are nullable — all migrations are additive
- [x] `evaluateRulesWithIds` logic verified: priority ordering ASC ✓, first-match-wins ✓, stackable opt-in ✓, per-rule budgetCapPoints ✓, program budget null for Issue #4 (noted in code)
