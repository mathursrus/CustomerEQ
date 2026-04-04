# Bug Bash Report -- Issue #99: Customer Health Score (Phase B: CRM Intelligence)

**Date**: 2026-04-03
**Branch**: `feature/99-phase-b-crm-intelligence-customer-health-score`
**Tester**: Claude (automated code-level bug bash)
**Scope**: Backend API, queue processors, shared types, MCP tools

---

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 0 | 0 | 0 |
| High (P1) | 2 | 2 | 0 |
| Medium (P2) | 6 | 0 | 6 |
| **Total** | **8** | **2** | **6** |

---

## Fixed Issues (P1)

### BUG-01: Code Duplication -- Pure Sub-Score Functions (P1, FIXED)
- **Category**: Code Quality / Maintainability
- **Location**: `apps/worker/src/processors/healthScore.ts` vs `apps/api/src/queues/healthScore.ts`
- **Description**: All 5 sub-score functions and the composite `computeHealthScore` function were copy-pasted into the worker processor instead of being shared.
- **Risk**: Silent drift if one copy is updated but not the other.
- **Fix Applied**: Moved pure functions to `@customerEQ/shared` (`packages/shared/src/types/health-score.ts`). Both API and worker now import from shared.
- **Verified**: Build passes, typecheck passes, 29/29 health score tests pass.

### BUG-02: MCP enroll_member Missing `consentGiven: true` (P1, FIXED)
- **Category**: Functionality / Bug
- **Location**: `apps/mcp-server/src/tools/members.ts` line 21
- **Description**: The MCP `enroll_member` tool sends `consentGivenAt` and `consentVersion` but omits `consentGiven: true`, which is required by `EnrollMemberSchema` (a `z.literal(true)`).
- **Impact**: 100% failure rate for all MCP enrollment calls (422 validation error).
- **Note**: Pre-existing bug, not introduced by this PR but discovered during review.
- **Fix Applied**: Added `consentGiven: true` to the request body.

---

## Remaining Issues (P2 -- Document as Follow-Ups)

### BUG-03: Worker Processor Duplicates Full DB Query+Compute Logic (P2)
- **Category**: Code Quality / Maintainability
- **Location**: `apps/worker/src/processors/healthScore.ts` (lines 66-127)
- **Description**: Beyond the pure functions (now fixed), the worker's `processHealthScore` duplicates the entire batch processing logic from `processHealthScoreComputation` in `apps/api/src/queues/healthScore.ts`. Both have identical DB query patterns, member iteration, distribution counting, and member.update calls.
- **Suggested Fix**: Have the worker import and call `processHealthScoreComputation` from the API module, or extract the shared batch logic to `@customerEQ/shared`.
- **Effort**: Medium (needs cross-app import strategy or shared extraction)

### BUG-04: N+1 Query Pattern in Batch Health Score Computation (P2)
- **Category**: Performance
- **Location**: Both `processHealthScoreComputation` and `processHealthScore`
- **Description**: For each member, 6 individual DB queries are executed sequentially: findFirst(lastEvent), count(events), aggregate(sentiment), findFirst(survey), count(campaignEvents), count(redemptions). For a brand with N members, this results in 6N+1 queries.
- **Impact**: Acceptable for small member counts but will cause significant latency for brands with 1000+ members.
- **Suggested Fix**: Batch the queries using raw SQL or Prisma batch operations. Consider adding pagination to batch processing.
- **Effort**: Large

### BUG-05: No min <= max Validation in HealthScoreFilterSchema (P2)
- **Category**: Data Validation
- **Location**: `packages/shared/src/zod/member.schema.ts`
- **Description**: `HealthScoreFilterSchema` allows `healthScoreMin=80&healthScoreMax=20` which silently returns zero results.
- **Suggested Fix**: Add a `.refine()` that validates `min <= max` when both are provided.
- **Effort**: Quick fix

### BUG-06: GET /v1/members Doesn't Exclude ERASED Members (P2)
- **Category**: Data Integrity
- **Location**: `apps/api/src/routes/members.ts` (line 385-388)
- **Description**: The members list endpoint filters by `deletedAt: null` but doesn't filter out members with `status: 'ERASED'` or `erased: true`. The batch recompute correctly filters these, but the list endpoint doesn't.
- **Impact**: ERASED members (GDPR) could appear in member listings.
- **Suggested Fix**: Add `status: { not: 'ERASED' }, erased: false` to the where clause.
- **Effort**: Quick fix

### BUG-07: 360 Endpoint Recomputes Health Score on Every Request (P2)
- **Category**: Performance
- **Location**: `apps/api/src/routes/members.ts` (line 274-279)
- **Description**: `GET /v1/members/:id/360` calls `computeHealthScoreForMember` (6 DB queries) on every request to provide a fresh breakdown. This is expensive for a read-heavy endpoint.
- **Impact**: Each 360 request triggers 12 DB queries (6 for breakdown + 6 for stats/activity) -- effectively N+1 for the single-member case.
- **Suggested Fix**: Cache the breakdown and only recompute if `healthScoreUpdatedAt` is stale (e.g., > 1 hour). Or return the cached score by default with an optional `?fresh=true` parameter.
- **Effort**: Medium

### BUG-08: No Rate Limiting on Recompute Endpoint (P2)
- **Category**: Security / Performance
- **Location**: `apps/api/src/routes/healthScores.ts`
- **Description**: `POST /v1/admin/health-scores/recompute` can be called repeatedly with no rate limiting. Each call triggers batch computation for all members.
- **Suggested Fix**: Add rate limiting (e.g., max 1 recompute per brand per 5 minutes) or deduplicate by checking if a job is already queued.
- **Effort**: Medium

---

## Priority Matrix

| Quadrant | Issues |
|----------|--------|
| **Do First** (high impact, low effort) | BUG-05 (filter validation), BUG-06 (ERASED filter) |
| **Schedule** (high impact, high effort) | BUG-03 (full dedup), BUG-04 (N+1 queries) |
| **Consider** (lower impact, medium effort) | BUG-07 (360 caching), BUG-08 (rate limiting) |
