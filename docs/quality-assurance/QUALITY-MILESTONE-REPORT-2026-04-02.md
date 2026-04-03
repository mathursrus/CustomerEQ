# Quality Milestone Report — 2026-04-02

## Summary

| Dimension | Status | Key Metric |
|-----------|--------|------------|
| **Build / Typecheck** | PASS | 9/9 turbo tasks, 13/13 typecheck clean |
| **Lint** | MISLEADING | Runs `tsc --noEmit` only — no ESLint configured |
| **Smoke Tests** | PASS | 79/79 tests pass across 9 files |
| **Broken Windows** | 3 issues | Inline mocks, console.log, missing ESLint |
| **Test Coverage** | GAPS | 11/15 API routes lack unit tests; 5 packages untested |
| **Test Standards** | PARTIAL | Shared utils exist but 4 files violate inline-mock rule |

---

## P0 — Fix Now (architecture violations, misleading CI signals)

### P0-1: `pnpm lint` does not run ESLint — project rules are inaccurate

**What**: Project rule #11 states `pnpm lint # ESLint — zero errors` but every app's lint script is `tsc --noEmit`. No `.eslintrc` or `eslint.config.*` exists in the project. This means:
- No code style enforcement (unused variables, dead imports, etc.)
- CI gate documented in `project_rules.md` is misleading
- Developers and agents trust a "lint pass" that checks nothing beyond types

**Fix**: Add ESLint with a TypeScript-aware config to at least `apps/api`, `apps/worker`, and `packages/shared`. Update lint scripts. Fix any violations surfaced.

**Risk**: Low — additive change, no runtime impact.

---

### P0-2: Inline mocks in 4 unit test files (violates Rule #8)

**What**: Project rule #8 requires all mocks to live in `packages/config/src/test-utils/`. Four unit test files define inline `vi.mock()`/`vi.fn()` totaling 32 inline mock definitions:

| File | Inline count |
|------|-------------|
| `apps/worker/src/processors/feedbackClustering.test.ts` | 17 |
| `apps/worker/src/processors/campaignTriggers.test.ts` | 11 |
| `apps/api/src/plugins/auth.test.ts` | 2 |
| `apps/api/src/routes/healthz.test.ts` | 2 |

**Fix**: Extract inline mocks to shared test-utils, then import from `@customerEQ/config/test-utils` in each test file.

**Risk**: Low — test-only changes, but must verify tests still pass after refactor.

---

## P1 — Fix Soon (broken windows, logging hygiene)

### P1-1: `console.log`/`console.error` in production code instead of Pino

**What**: 3 production files use console.* where Pino logger is available:

| File | Line | Usage |
|------|------|-------|
| `apps/worker/src/processors/alertEvaluation.ts` | 229 | `console.log` for email alerts |
| `apps/api/src/server.ts` | 19 | `console.error` for fatal startup |
| `packages/ai/src/client.ts` | 23 | `console.warn` for BAML fallback |

2 frontend files also use `console.error` (less critical for server-side observability).

**Fix**: Replace with Pino logger calls in backend files. Frontend files are lower priority.

**Risk**: Very low — logging-only change.

---

### P1-2: 11 API route files have no unit tests

**What**: Only 4 of 15 route files have unit tests. Missing:
- `campaigns.ts`, `campaignPlay.ts`, `cases.ts`, `members.ts`, `programs.ts`
- `public.ts`, `redemptions.ts`, `rewards.ts`, `templates.ts`, `themes.ts`, `alertRules.ts`

**Mitigating factor**: 14 integration tests exist under `apps/api/test/integration/` and cover most of these routes with real DB tests. The gap is in fast, isolated unit tests for schema validation and business logic.

**Fix**: Add unit tests for route files that have Zod schema validation or non-trivial business logic (prioritize: campaigns, members, rewards, alertRules).

**Risk**: Low — additive test-only changes.

---

### P1-3: 3 API plugins have no tests

**What**: `audit.ts`, `prisma.ts`, and `redis.ts` plugins have no test files. `auth.ts` and `multiTenant.ts` are covered.

**Fix**: Add unit tests, especially for `prisma.ts` (tenant scoping middleware — critical for multi-tenant security).

**Risk**: Low — test-only.

---

## P2 — Track (minor gaps, low-risk items)

### P2-1: No custom error hierarchy

**What**: All errors use bare `new Error()` or Fastify `reply.status().send()`. No `AppError` class with error codes. This works fine now but makes error classification harder as the codebase grows.

**Track**: Consider adding when error handling becomes a pain point.

---

### P2-2: 5 packages have zero test files

**What**: `apps/web`, `apps/mcp-server`, `packages/database`, `packages/ui`, `packages/embed` have no unit tests.

**Mitigating**: Web app is tested via Playwright E2E. MCP server and embed are thin wrappers. Database package is tested transitively via integration tests.

**Track**: Add tests if bugs emerge in these packages.

---

### P2-3: Frontend console.error usage

**What**: 2 files in `apps/web` use `console.error` for error handling in admin pages. Acceptable for client-side code but could use a structured error boundary pattern.

**Track**: Address when adding error monitoring (e.g., Sentry).

---

### P2-4: Only 2 TODOs in codebase

**What**: `packages/ai/src/client.ts:21` — "Wire up BAML generated client". This is a known pending item, not a broken window.

**Track**: Will resolve when BAML generation is integrated into the build.

---

## Metrics Summary — Final (Verified 2026-04-02)

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Build | PASS | PASS | maintained |
| Typecheck (strict) | PASS | PASS | maintained |
| ESLint | NOT CONFIGURED | 0 errors, 0 warnings | FIXED |
| Total test files | 25 | 40 | +60% |
| Total tests | ~400 | 582 | +45% |
| Inline mock violations | 32 across 4 files | 0 | FIXED |
| console.* in backend | 3 files | 0 | FIXED |
| Untested API routes | 11/15 | 6/15 | IMPROVED |
| Untested plugins | 3/5 | 0/5 | FIXED |
| Untested packages | 5/10 | 2/10 | IMPROVED |
| Skipped tests | 0 | 0 | maintained |

### Bug Found During ESLint Setup
ESLint caught a real bug in `apps/web/src/app/spin/[id]/page.tsx:116`:
`!data?.winningIndex === undefined` was a constant binary expression (always false).
Fixed to `data?.winningIndex === undefined`.
