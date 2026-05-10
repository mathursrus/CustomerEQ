---
author: swavak@gmail.com
date: 2026-04-02
synthesized: 2026-05-08
---

# Postmortem: Member Enrollment — Issue #3

**Date**: 2026-04-02
**Duration**: ~2 sessions (context compaction mid-session)
**Objective**: Implement end-to-end member enrollment flow — enrollment form, API route, welcome screen, consent capture, duplicate detection
**Outcome**: Success — PR #90 merged to main (squash commit `4c85b72`)

---

## Executive Summary

Member enrollment was implemented across DB, API, and Web with all 19 spec requirements traced. The core feature landed cleanly but required a second context session to complete validation, quality review, evidence documentation, and submission phases. The main execution challenges were environment-level (Playwright loopback networking on Windows, pnpm not in PATH in bash shell) rather than code-level.

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `4.1 API Routes` (`/v1/public/*` row), `4.4 Database Models` (Member, Program entities), `3.1 Web App` (middleware public routes)
**Changes Made**: `POST /v1/members/enroll` added as public route; `GET /v1/public/programs/by-slug/:slug` added; `Member` entity now tracks `emailOptIn`, `smsOptIn`, `consentGivenAt`, `consentVersion`; `Program.slug` added; enrollment route documented as unauthenticated
**Rationale**: New member-facing surface with unauthenticated entry point requires explicit documentation of public route boundary
**Updated in PR**: Yes — `docs/architecture/architecture.md` updated in `bc4939e` / `54cef5d` (post-rebase)

---

## Timeline of Events

### Phase 1: implement-scoping
- ✅ Read spec, RFC, work list — 9 files identified, no phase split needed
- ✅ Locked in design decisions: 409 not 200 for duplicate, brandId from programId lookup, public route config

### Phase 2: implement-tests (Phase 3 in job)
- ✅ 26 Zod schema tests in `member.schema.test.ts` (240 total passing)
- ✅ 13 integration tests in `members.test.ts` covering all API edge cases
- ✅ 10 E2E tests in `enrollment.spec.ts` — all viewports, happy path, error states
- ✅ Fixed: duplicate-email test was asserting 200, changed to 409
- ✅ Fixed: tests were using authenticated request; enrollment is public, switched to `unauthenticatedRequest()`

### Phase 3: implement-code (Phase 4 in job)
- ✅ Core feature was already implemented in prior session (`46e3cbc`)
- ✅ Fixed: `body as EnrollResponse` TS2352 → `body as unknown as EnrollResponse`
- ✅ Fixed: middleware public route `/(.*)/enroll` added
- ✅ Fixed: `clerkMiddleware()` throws at module-init time even with runtime guard — passed placeholder keys in options
- ❌ HSTS issue: initial placeholder used `*.lcl.dev` TLD (HSTS preloaded by Chromium) → `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`
- ✅ Fixed: switched to `*.fake` TLD for placeholder Clerk key

### Phase 4: implement-validate
- ✅ CI gates: 240/240 unit tests, 0 typecheck errors, 0 lint errors
- ✅ SSR validation via curl — enrollment form HTML confirmed
- ❌ Browser screenshots blocked: Playwright Chromium on this Windows machine cannot make loopback network connections (affects all existing e2e specs — machine-level environment issue)
- ✅ Documented environment limitation in UI validation evidence

### Phase 5: implement-regression
- ✅ 240/240 smoke tests, 0 typecheck errors, 0 lint errors — no regressions

### Phase 6: implement-quality
- ❌ Found: `EnrollResponse` interface duplicated in `EnrollmentForm.tsx` and `WelcomeScreen.tsx` — should import `EnrollMemberResponse` from `@customerEQ/shared`
- ✅ Fixed both files, typecheck confirmed clean

### Phase 7: implement-completeness-review
- ✅ All 9 work list items confirmed implemented
- ✅ Traceability matrix: 15 Met, 2 Partial (R8/R9 — offline Redis), 2 Deferred (R2 SSO, R11 AuditEvent), 0 Unmet
- ✅ Evidence doc created at `docs/evidence/3-feature-implementation-evidence.md`

### Phase 8: implement-architecture-update
- ✅ `docs/architecture/architecture.md` updated — 4 targeted changes

### Phase 9: implement-submission
- ✅ Branch pushed, PR #90 created, issue labeled `status:needs-review`
- ❌ PR showed `mergeable_state: dirty` — main had moved forward 2 commits since branch was created
- ✅ Rebased twice (first: skipped already-merged commits; second: resolved architecture.md conflict)

### Phase 10: address-feedback
- ✅ No human feedback received — PR merged directly

### Phase 11: retrospective
- This document

---

## Root Cause Analysis

### 1. Duplicate type definition not caught earlier
**Problem**: `EnrollResponse` was defined locally in two adjacent files instead of importing from `@customerEQ/shared` where `EnrollMemberResponse` already existed.
**Impact**: P1 quality issue found in quality phase, required extra commit. Should have been caught during code implementation.
**Root Cause**: When writing client components, it's natural to define inline interfaces quickly. Without explicitly checking `@customerEQ/shared` exports before defining a new type, duplication goes unnoticed.

### 2. Clerk middleware validation at module-init time
**Problem**: The `isE2E` runtime guard inside the handler doesn't prevent Clerk from validating the publishable key when the module is imported.
**Impact**: Multiple iterations to find the correct fix (runtime guard → HSTS issue with `lcl.dev` → switch to `fake` TLD).
**Root Cause**: Clerk's `clerkMiddleware()` validates key format immediately at `require()` time, not when the middleware handler is first called. This is underdocumented.

### 3. Rebase conflict on architecture.md
**Problem**: While the feature branch was being prepared for PR, `main` received two new commits (PR #89 Spin-the-Wheel) that also modified `architecture.md`. The `/v1/public/*` row was updated by both.
**Impact**: Required a second rebase with manual conflict resolution before PR could merge.
**Root Cause**: Long-lived feature branch + active main branch = inevitable architecture doc conflicts.

### 4. Context compaction mid-session
**Problem**: Session ran out of context mid-Phase 4 (implement-validate).
**Impact**: Second session needed; required summary reading to recover state.
**Root Cause**: Implementation + test writing + validation for a multi-layer feature is context-heavy. No fault in approach, but earlier snapshots would help.

---

## What Went Wrong

1. **HSTS on `*.lcl.dev`**: Spent multiple iterations on the Clerk placeholder key before discovering the TLD was HSTS-preloaded. Should have used `*.fake` from the start.
2. **Duplicate `EnrollResponse`**: Found in quality phase rather than during code — a quick grep for the type name before defining it would have caught this.
3. **Rebase conflict on architecture.md**: The architecture doc is a merge conflict hotspot when multiple features land in parallel.
4. **Playwright loopback networking**: Environment-level issue blocked browser screenshots entirely. Needed an alternative validation path (SSR HTML via curl) which was less satisfying but sufficient.

---

## What Went Right

1. **Test-first approach**: Writing tests before validating made regressions impossible — the duplicate-email 409 vs 200 bug was caught immediately by the test.
2. **`unauthenticatedRequest()` recognition**: Quickly identified that enrollment tests needed to use the public request helper rather than the authenticated one.
3. **Traceability matrix**: Mapping all 19 requirements to implementation evidence and proof gave clear confidence in completeness, and surfaced R11 (AuditEvent) and R2 (SSO) as conscious deferrals rather than forgotten items.
4. **Non-blocking enqueue pattern**: `enqueueEvent` and `enqueueNotification` with `.catch()` kept the 201 response fast and clean.
5. **SSR validation via curl**: When Playwright couldn't run, falling back to curl-verified SSR HTML proved the form renders correctly without a browser.
6. **Rebase over merge**: Using rebase kept the branch history clean and PR diff minimal (3 commits, 235 additions).

---

## Lessons Learned

1. **Check `@customerEQ/shared` exports before defining new types in web components.** The shared package has Zod-derived TypeScript types for all API response shapes. Always grep for the type name in `packages/shared/src/` before creating a local interface.
2. **Clerk placeholder keys must use a non-HSTS TLD.** `lcl.dev` is HSTS-preloaded. For test placeholder keys, use `.fake` or `.example` (not `.lcl.dev`, `.localhost`, or `.dev`).
3. **`clerkMiddleware(options)` validates the publishable key at import time**, not at invocation time. Runtime environment guards inside the handler do not protect against this. Always pass placeholder keys in the options object when `PLAYWRIGHT_TEST=true`.
4. **Architecture docs are merge conflict hotspots.** When a feature modifies `architecture.md`, expect conflicts if other PRs land on main simultaneously. Keep architecture doc changes minimal and targeted.
5. **For long multi-layer features, split implementation and validation into separate sessions** to avoid context compaction mid-validation.

---

## Agent Rule Updates Made to avoid recurrence

1. **Before defining any TypeScript interface for an API response shape in `apps/web/`, grep `packages/shared/src/zod/` for an existing type.** If found, import it instead of redefining.
2. **For Clerk E2E bypass, always use `pk_test_<base64url(host + '$')>` with a `.fake` or `.invalid` TLD** (RFC 2606 reserved — guaranteed not HSTS-preloaded).

---

## Enforcement Updates Made to avoid recurrence

1. **Add to quality checklist**: "Are there any locally-defined interfaces that duplicate types already in `@customerEQ/shared`?" — check during implement-quality phase before committing.
2. **When `architecture.md` is modified**, always check if other open PRs also modify it and coordinate the rebase order to avoid repeated conflict resolution.
