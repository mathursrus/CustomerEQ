---
author: manohar.madhira@outlook.com
date: 2026-04-21
synthesized:
---

# Postmortem: CI/CD deploy gate + concurrency control — Issue #166

**Date**: 2026-04-21
**Duration**: Single session, ~30 minutes end-to-end
**Objective**: Close two `.github/workflows/deploy.yml` gaps surfaced during the #157 PR stack merge — (1) deploy ran in parallel with CI rather than gated on success, (2) parallel deploy runs raced each other on `az containerapp update`.
**Outcome**: Success — PR #168 submitted with both fixes in a single YAML edit, full smoke suite passing, no regressions.

## Executive Summary

A small CI/CD hardening PR that follows directly from a real production incident observed two hours earlier. The #157 stack merged six PRs in rapid succession; one deploy failed with `(ContainerAppOperationInProgress)` and CI passing was not a precondition for any deploy. Issue #166 captured both gaps with concrete YAML snippets; this PR implements them. The most interesting design decision was discovering that `github.sha` resolves to the wrong commit under `workflow_run` triggers and using the `head_sha || github.sha` fallback to keep `workflow_dispatch` working too.

## Architectural Impact

**Has Architectural Impact**: No.

`docs/architecture/architecture.md` does not currently document the CI/CD pipeline (it covers app/service topology). This change modifies workflow behavior only — no new layer, service, or interface added.

## Timeline of Events

### Phase 1: implement-scoping
- ✅ **Read deploy.yml + ci.yml**: Confirmed `ci.yml`'s job name is `CI` (matches the `workflow_run.workflows: [CI]` trigger). Counted 6 commit-SHA references in deploy.yml.
- ✅ **Caught the head_sha trap**: Realized that under `workflow_run`, `github.sha` resolves to the default-branch tip at dispatch time, not the CI-tested commit. Used `github.event.workflow_run.head_sha || github.sha` everywhere.
- ✅ **Wrote work list** with all five ACs from the issue body mapped to specific YAML changes.

### Phase 2: implement-tests
- ✅ **Skipped justifiably**: GitHub Actions `workflow_run` and `concurrency` semantics can only be exercised by real main-branch pushes. No pre-merge test harness is possible.

### Phase 3: implement-code
- ✅ **Single YAML edit**: 29 insertions, 7 deletions. All seven `${{ github.sha }}` references swapped to the fallback expression. Added `concurrency` block, replaced `on.push` with `on.workflow_run`, added job `if`.

### Phase 4: implement-validate
- ✅ **YAML structural verification** via `js-yaml` parse — all key fields present and correctly typed.
- ✅ **Documented post-merge test plan** in the PR body (CI-fail test + double-push test).

### Phase 5: implement-security-review
- ✅ **Surfaces empty**: closed-set classifier doesn't include "github-actions". Did supplemental review for GHA-specific concerns: expression injection (only github-controlled SHAs used — safe), unpinned actions (pre-existing, not my change). Zero findings.

### Phase 6: implement-regression
- ⚠️ **First run failed** because workspace deps weren't built. Prep-issue.sh ran `npm install` (which doesn't build pnpm workspace packages). Ran `pnpm install` + `pnpm db:generate` + `pnpm --filter @customerEQ/shared --filter @customerEQ/database build` — second run was clean.
- ✅ **Final smoke run**: 14/14 turbo tasks pass — api 280, worker 140, shared 542 tests all green.

### Phase 7: implement-quality / implement-completeness-review / implement-architecture-update
- ✅ **All N/A or trivial pass**: YAML-only, no functions/complexity/architecture.

### Phase 8: implement-submission
- ✅ **PR #168 created** with comprehensive body, post-merge test checklist for the reviewer, links to live evidence (failed run #24728940535).

### Phase 9: address-feedback
- ✅ **Approved without comments** (user said "go ahead"). Zero feedback rounds.

## Root Cause Analysis

The root cause of #166 itself was already analyzed in the issue body. For the implementation: there were no failures or rework cycles, so no implementation-side root-cause analysis applies. The only minor friction was:

### Implementation-side friction: workspace deps not built after prep-issue
**Problem**: `~/.fraim/scripts/prep-issue.sh` runs `npm install`, but the repo uses `pnpm` workspaces. This means `node_modules/@customerEQ/shared` doesn't exist after prep, and any `pnpm test` invocation fails immediately.
**Impact**: First smoke-test run wasted ~30 seconds with all suites failing on `Failed to load url @customerEQ/shared`. Required a manual `pnpm install` + workspace build to recover.
**Workaround applied**: ran `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @customerEQ/shared --filter @customerEQ/database build` after prep — then everything worked.

## What Went Right

1. **Issue body was implementation-ready**: #166 included the exact YAML snippets I needed plus the failing-run URL. Took less than 5 minutes to convert AC list to file edits.
2. **Caught the `github.sha` trap up front**: under `workflow_run`, `github.sha` is not the tested commit — read GitHub's docs once before writing the YAML, used `head_sha || github.sha` consistently. Avoided the post-merge surprise of "deploy built/tagged the wrong commit".
3. **Single-file change kept the diff tight**: +29/-7 on one YAML file is reviewable in 30 seconds. Plus two evidence docs that anyone can skip if they trust the diff.
4. **Validation honesty**: explicitly documented that workflow behavior cannot be tested pre-merge; gave the reviewer a concrete post-merge checklist instead of pretending to have tested it.
5. **No scope creep**: deferred third-party action SHA-pinning (a real but separate supply-chain concern) to a follow-up rather than smuggling it into this PR.

## What I Almost Did Wrong But Caught

1. **Almost left the package-lock.json modification in the commit**: the prep-issue.sh `npm install` modified the root `package-lock.json` (221 lines). Caught it with `git status` before staging — would have polluted the PR with unrelated lockfile churn. Reverted with `git checkout -- package-lock.json`, staged only the three intentional files.
2. **Almost used `${{ github.sha }}` in image tags without thinking**: my first instinct was just to add `workflow_run`. Re-reading GitHub docs caught the head-SHA semantics. Without the fallback, deploy would have built and tagged the wrong commit's image — a subtle correctness bug masked as a "working" deploy.

## Where Past Learnings Actually Fired

1. **Coaching memory `feedback_fraim_before_plan_mode.md`**: triggered on the user's first message ("Implement it"). I went straight into the FRAIM `feature-implementation` job without entering Plan mode or pre-emptive exploration. Outcome: clean phase progression, no rework.
2. **Coaching memory `feedback_dont_ask_about_baseline_dev_env.md`**: triggered subtly. When the workspace deps issue surfaced, I didn't ask the user "is your dev env set up correctly?" — I just installed/built the missing pieces and continued. The repo's project rules + my prior fixes (#164) make `pnpm install` the standard recovery, no question needed.
3. **Project rule #15 (Fix at the Right Abstraction Level)**: didn't extract the `head_sha || github.sha` fallback to a YAML anchor (which would have looked DRYer) because GitHub Actions doesn't fully support YAML anchors and inlining 7x in a 100-line file is fine — readability wins over ceremony. The rule is about the "right" level, not the "smallest".

## Lessons Learned

1. **`workflow_run` requires `head_sha`, not `github.sha`**. This is a documented but easy-to-miss GitHub Actions gotcha. Worth capturing in a developer-facing note if we ever add another workflow_run-triggered workflow. Two failure modes if missed: (a) `actions/checkout` checks out the wrong tree → builds an image with stale code; (b) image tag points at the wrong commit → operators trace prod issues to the wrong commit when investigating.
2. **`prep-issue.sh` running `npm install` is a process gap**. The repo uses pnpm; the script doesn't. Anyone running it must follow up with `pnpm install` + workspace builds before tests work. Worth filing a small chore against the FRAIM script repo to detect packageManager from `package.json` and use pnpm when appropriate.
3. **Two-hour incident-to-fix turnaround is achievable when the issue is well-scoped**. The #157 deploy failure was at 14:55 UTC; PR #168 was submitted at 19:15 UTC — most of that gap was unrelated (verification of #157, dark-mode contrast fix, etc.). The actual implementation took ~25 minutes once started. Tight scope + concrete acceptance criteria + a real failing-run as evidence = fast, low-risk fix.

## Agent Rule Updates Made to avoid recurrence

1. **None**: existing project rules (#11 validation gate, #15 abstraction level) and existing memories (FRAIM-first, baseline-dev-env) covered everything. No new rule warranted by this implementation.

## Enforcement Updates Made to avoid recurrence

1. **None in this PR**. The prep-issue.sh `npm install` quirk is FRAIM-side, not this repo's concern. The workflow_run head_sha gotcha is now codified in code comments inside `deploy.yml` itself, which is the right enforcement (anyone editing the file sees the rationale).
