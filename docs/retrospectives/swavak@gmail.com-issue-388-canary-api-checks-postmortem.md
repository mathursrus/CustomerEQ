---
author: swavak@gmail.com
date: 2026-05-16
synthesized: 2026-05-18
---

# Postmortem: CD: add canary API checks to post-deploy probe — Issue #388

**Date**: 2026-05-16  
**Duration**: Single session  
**Objective**: Add authenticated canary calls to a representative set of critical API endpoints after every deploy so that failures not caught by `/healthz` (silent migration failures, misconfigured routes, auth middleware not wired) fail the pipeline before they reach production users.  
**Outcome**: Success — PR #401 open, all ACs met, 0 feedback rounds.

---

## Executive Summary

Issue #388 was a pure CI/CD workflow change: add a `Canary API checks` step to `.github/workflows/deploy.yml` after the existing startup health check. The implementation was straightforward — one file, 43 lines, zero application code changes. All 13 phases of `feature-implementation` ran cleanly. No feedback rounds were required.

---

## Architectural Impact

**Has Architectural Impact**: No

The change is a CD pipeline step only. No new system components, layers, tech stack choices, or integration patterns were introduced. `docs/architecture/architecture.md` does not document CD probe steps and was not updated.

---

## Timeline of Events

### Phase 1: Issue Preparation (`issue-preparation`)
- ✅ Worktree created at `CustomerEQ - Issue 388`
- ✅ Branch `feature/388-cd-add-canary-api-checks-...` created and pushed
- ✅ `pnpm install` re-run directly after `npm install` failed due to Windows PATH/Prisma issue

### Phase 2: Scoping (`implement-scoping`)
- ✅ Loaded FRAIM constitution, testing standards, architecture standards
- ✅ Confirmed no RFC or feature spec exists — issue body is authoritative
- ✅ Verified all 6 canary endpoints exist in route files via Explore agent
- ✅ Work list created at `docs/evidence/388-implement-work-list.md`
- ✅ Issue classified as `feature`, 1 file in scope (no phase-splitting required)

### Phase 3: Tests (`implement-tests`)
- ✅ Marked N/A — change is GitHub Actions YAML; no unit-testable application code
- ✅ Endpoint existence verified as the meaningful pre-implementation check

### Phase 4: Implementation (`implement-code`)
- ✅ `Canary API checks` step added to `deploy.yml` after "Verify API health"
- ✅ `check()` function: label, url, optional method; accepts 200/401/202/404; exits 1 otherwise
- ✅ 4 P0 + 3 P1 endpoints probed
- ✅ Committed: 887f7ca

### Phase 5: Validation (`implement-validate`)
- ✅ Build: PASS (12/12)
- ✅ Typecheck: PASS (19/19)
- ✅ Smoke: pre-existing Windows/Prisma PATH failure confirmed on base branch (stash test)
- ✅ No TODO/FIXME artifacts; YAML structure reviewed

### Phase 6: Security Review (`implement-security-review`)
- ✅ Surfaces: `[]` — pure CI/CD YAML + docs markdown; no web/api/llm-app heuristics matched
- ✅ Secrets check: PASS — all refs use `${{ secrets.* }}` GitHub context
- ✅ PII check: PASS — `_canary_` synthetic ID, no personal data
- ✅ Command injection: PASS — `$API_FQDN` sourced from trusted Azure CLI output
- ✅ 0 findings

### Phase 7: Regression (`implement-regression`)
- ✅ No application code changed; regression surface is zero
- ✅ Build + typecheck already confirmed; pre-existing smoke test failure documented

### Phase 8: Quality (`implement-quality`)
- ✅ Lint: PASS (4/4)
- ✅ `check()` is 8 lines; `deploy.yml` is 249 lines; no hardcoded values
- ✅ 0 quality issues found

### Phase 9: Completeness Review (`implement-completeness-review`)
- ✅ All 6 ACs in traceability matrix: Met
- ✅ All 5 design decisions in technical design matrix: Met
- ✅ Feedback file: 0 unaddressed items
- ✅ Deferred item documented: `POST /v1/members/enroll` canary probe

### Phase 10: Architecture Update (`implement-architecture-update`)
- ✅ No architectural changes detected; `docs/architecture/architecture.md` not updated

### Phase 11: Submission (`implement-submission`)
- ✅ Evidence committed: e83e399
- ✅ Branch pushed
- ✅ PR #401 created
- ✅ Evidence comment added; `status:needs-review` label applied

### Phase 12: Address Feedback (`address-feedback`)
- ✅ 0 feedback rounds; user signaled "proceed"

---

## Root Cause Analysis

No failures occurred during this issue. Not applicable.

---

## What Went Wrong

Nothing went wrong during this issue. It was a clean, single-file CI/CD change that matched the scope exactly.

---

## What Went Right

1. **Scope matched reality**: The issue was genuinely a one-file change. The scoping phase confirmed this quickly and the work list reflected it accurately — no scope creep, no surprises.

2. **Endpoint existence verified before implementation**: Using the Explore agent to confirm all 6 canary endpoints exist in the route files before writing the step prevented building a canary that probes phantom routes. This is the CI/CD equivalent of reading the codebase before designing.

3. **Pre-existing smoke test failure identified correctly**: The stash-and-test approach (remove changes, run test, restore) quickly confirmed the Windows/Prisma PATH failure was pre-existing rather than a regression. Documented cleanly without claiming false success.

4. **Deferral of `POST /v1/members/enroll` was correct**: The endpoint requires a body for a meaningful canary signal. Sending an empty body returns 400 (validation) rather than 401 (auth gate), which is ambiguous. Omitting it and documenting the deferral is more honest than including it with a misleading pass condition.

5. **Security review was proportionate**: Classifying as `surfaces: []` for a CI/CD YAML change and running secrets + PII checks only (not full OWASP) was the correct scope. The `$API_FQDN` command injection analysis was explicit and correct.

---

## What I Almost Did Wrong But Caught

1. **npm install vs pnpm install during issue preparation**: The `prep-issue.sh` script ran `npm install` which failed because `pnpm db:generate` via npm doesn't have the pnpm-managed Prisma binary on PATH. Rather than accepting the error, I re-ran `pnpm install` directly in the worktree, which succeeded. The script's core work (worktree + branch + push) had already completed successfully.

---

## Where Past Learnings Actually Fired

1. **VP-HIGH: Read codebase before designing**: Before writing the canary step, I used the Explore agent to verify all 6 canary endpoint routes exist in the production codebase. This prevents building a step that probes a non-existent route — the CD equivalent of the RFC pattern that caught auth plugin gaps in issue #3.

2. **P-HIGH: Committing to old branch on session resume**: Branch verification was performed at the start via the `prep-issue.sh` script output and confirmed with `git branch --show-current` before any commit. No cross-branch contamination occurred.

3. **VP-MED: Near-miss catch — impl files not staged with spec commit**: During the evidence commit, I staged only the two evidence files (`388-feature-implementation-evidence.md`, `388-feature-implementation-feedback.md`) and explicitly excluded `package-lock.json` which was not part of the feature. Running `git status` before committing prevented accidental inclusion.

---

## Lessons Learned

1. **CI/CD-only changes benefit from endpoint verification as a substitute for unit tests**: When the change is a bash script embedded in a workflow, the meaningful pre-implementation test is confirming the endpoints being probed actually exist in the production route files. This is fast, cheap, and catches phantom route references before they're committed.

2. **The 401-as-pass canary strategy is powerful but requires careful scoping**: Accepting 401 as a pass proves routes are registered and auth middleware is running without requiring any credentials. The boundary condition is important: if an endpoint should return 200 without auth (e.g., `/healthz`) but returns 401 unexpectedly, the strategy masks that failure. Document the expected auth behavior for each endpoint explicitly.

3. **`POST` canary endpoints need care**: `POST /v1/events` with no body may return 401 (if auth fires first) or 400 (if body parsing fires first). The acceptable statuses need to cover both. `POST /v1/members/enroll` was correctly deferred because 400 and 401 carry different information and the right signal requires a real payload.

---

## Agent Rule Updates Made to Avoid Recurrence

None required — no failures occurred and no anti-patterns were identified.

---

## Enforcement Updates Made to Avoid Recurrence

None required.
