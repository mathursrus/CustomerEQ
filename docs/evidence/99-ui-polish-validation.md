# UI Polish Validation — Issue #99: Customer Health Score (Phase B: CRM Intelligence)

**Date**: 2026-04-03
**Branch**: `feature/99-phase-b-crm-intelligence-customer-health-score`
**Commit**: `fa4695f`

---

## Quality Contract

### Scope
Issue #99 is a **backend-only feature** with no frontend/UI components. The implementation includes:
- New Prisma fields: `healthScore`, `healthScoreUpdatedAt` on Member model
- Health score computation logic (5 weighted sub-scores)
- BullMQ queue for batch/single member computation
- API routes: `GET /v1/members/:id/360`, `GET /v1/members` (with health score filters), `POST /v1/admin/health-scores/recompute`
- MCP tool: `get_member_360`
- Worker processor: `apps/worker/src/processors/healthScore.ts`

### UI Validation Applicability
- `uiValidationRequired`: **No** -- no frontend pages, components, or browser-rendered UI was added or modified.
- `mobileValidationRequired`: **No**
- Browser testing: **Not applicable**
- Breakpoints: **Not applicable**

### Severity Policy
- P0: core flow blocked or severe visual corruption
- P1: obvious polish regression in major flow
- P2: minor visual inconsistency

### Verdict
**UI Polish Validation: NOT APPLICABLE (backend-only feature)**

No UI components, pages, or frontend code were added or modified in this issue. All changes are in API routes, queue processors, shared types, and database schema. Phases 2-9 (environment setup, preflight checks, Playwright smoke, responsive audit, typography audit, overlap audit, interaction audit, console audit) are all N/A.

### Evidence Directory
`docs/evidence/ui-polish/99/` (empty -- no screenshots needed)

---

## Static Code Review (In Lieu of Visual UI Audit)

Since this is a backend feature, the quality validation focuses on API contract correctness, type safety, and code quality rather than visual polish. These findings are documented here and will be expanded in the `user-testing-and-bug-bash` and `test-execution` jobs.

### Files Reviewed
| File | Purpose | Status |
|---|---|---|
| `apps/api/src/queues/healthScore.ts` | Sub-score computation + batch processor | Reviewed |
| `apps/api/src/queues/healthScore.test.ts` | Unit tests for pure computation functions | Reviewed |
| `apps/api/src/routes/healthScores.ts` | POST /v1/admin/health-scores/recompute | Reviewed |
| `apps/api/src/routes/members.ts` | GET /v1/members, GET /v1/members/:id/360 | Reviewed |
| `apps/worker/src/processors/healthScore.ts` | BullMQ worker processor | Reviewed |
| `packages/shared/src/types/health-score.ts` | Type definitions + default weights | Reviewed |
| `packages/shared/src/zod/member.schema.ts` | Zod schemas for validation | Reviewed |
| `apps/mcp-server/src/tools/members.ts` | MCP get_member_360 tool | Reviewed |
| `packages/database/prisma/schema.prisma` | healthScore, healthScoreUpdatedAt fields | Reviewed |

### Preliminary Findings (Detail in Bug Bash Job)

1. **CODE DUPLICATION (P1)**: The sub-score computation functions are duplicated between `apps/api/src/queues/healthScore.ts` and `apps/worker/src/processors/healthScore.ts`. The worker file has its own copy of `computeRecencyScore`, `computeFrequencyScore`, `computeSentimentScore`, `computeNpsScore`, `computeEngagementScore` instead of importing from the shared module. This violates DRY and creates drift risk.

2. **Missing `consentGiven: true` in MCP enroll_member tool (P1)**: The MCP `enroll_member` tool in `apps/mcp-server/src/tools/members.ts` sends `consentGivenAt` and `consentVersion` but does NOT send `consentGiven: true`, which is required by `EnrollMemberSchema` (a `z.literal(true)`). Every MCP enrollment call will fail with a 422 validation error.

3. **No pagination on GET /v1/members (P2)**: The members list endpoint has a hard `take: 100` limit with no offset/cursor support. For brands with many members, this limits utility.

4. **No authorization check on recompute endpoint (P2)**: The `POST /v1/admin/health-scores/recompute` route has no explicit admin role check beyond whatever the global auth middleware provides. Should verify the caller has admin privileges.

---

## Defect Triage

| ID | Severity | Category | Description | Action |
|----|----------|----------|-------------|--------|
| D1 | P1 | Code Quality | Sub-score functions duplicated in worker processor instead of importing from shared API module | Fix in bug-bash job |
| D2 | P1 | Bug | MCP enroll_member tool missing `consentGiven: true` -- all MCP enrollments fail with 422 | Fix in bug-bash job |
| D3 | P2 | API Design | GET /v1/members lacks pagination (hard limit 100) | Document as follow-up |
| D4 | P2 | Security | Recompute endpoint relies on route prefix convention for admin auth | Document as follow-up |

### Blocking Findings
- **D2 is a functional bug** that causes 100% failure rate for MCP enrollment calls. This is a pre-existing bug (not introduced by this PR) but was discovered during review.
- **D1 is a maintainability risk** that will cause silent divergence if either copy is updated independently.

---

## Fixes Applied

### D1 Fix: Deduplicated Sub-Score Functions
- Moved all 5 pure sub-score functions + `computeHealthScore` + `HealthScoreInputs` to `@customerEQ/shared` (`packages/shared/src/types/health-score.ts`)
- Updated `packages/shared/src/types/index.ts` to export new functions
- Updated `apps/api/src/queues/healthScore.ts` to import from `@customerEQ/shared` (re-exports for existing consumers)
- Updated `apps/worker/src/processors/healthScore.ts` to import from `@customerEQ/shared` (removed ~40 lines of duplicated code)

### D2 Fix: MCP enroll_member Missing consentGiven
- Added `consentGiven: true` to the request body in `apps/mcp-server/src/tools/members.ts`

### Regression Verification
- Build: 9/9 tasks pass
- Typecheck: 13/13 tasks pass, 0 errors
- Health score unit tests: 29/29 pass
- API smoke tests: 192/192 pass (in isolation; turbo parallel runner has known Windows Prisma segfault)

---

## Final Signoff

| Criterion | Status |
|-----------|--------|
| UI visual validation | N/A (backend-only) |
| Build passes | PASS |
| Typecheck passes | PASS |
| Unit tests pass | PASS (29/29 health score, 192/192 API total) |
| P0 defects resolved | N/A (none found) |
| P1 defects resolved | PASS (D1, D2 both fixed) |
| P2 defects documented | PASS (D3, D4 documented as follow-ups) |

**VERDICT: PASS**

All P1 defects have been fixed and verified. P2 items are documented for follow-up. No UI validation was needed (backend-only feature). Code quality improved by deduplication.
