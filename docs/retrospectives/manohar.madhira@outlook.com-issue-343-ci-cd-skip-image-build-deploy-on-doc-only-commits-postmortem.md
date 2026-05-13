---
author: manohar.madhira@outlook.com
date: 2026-05-12
synthesized:
---

# Postmortem: CI/CD — skip image build + deploy on doc-only commits — Issue #343

**Date**: 2026-05-12
**Duration**: ~1 conversational session, ~3 hours wall-clock end-to-end (issue file → first PR merge → regression discovery → second PR merge → first successful deploy → retrospective).
**Objective**: Gate `.github/workflows/ci.yml` `docker-build` and `.github/workflows/deploy.yml` `build-and-deploy` so doc-only commits skip the ~17 min image build and the ~5–10 min ACR build + Container Apps rolling redeploy. Keep the `ci` job (typecheck/lint/build/test/audit) unfiltered.
**Outcome**: SUCCESS, after one regression cycle. Initial PR #346 (merge `7909d52`) shipped with two latent bugs; both surfaced post-open and were fixed in #346 itself (Round 1) and a follow-up issue #347 / PR #348 (Round 2). End-to-end validation: the merge of #348 (`1b3ba02`) produced the first successful deploy since #346 went in — full ACR build + Container Apps update + healthcheck `API health check passed`.

## Executive Summary

A small two-file CI/CD change that the FRAIM Phase 5 validation showed as green but that had two bugs hiding behind it, both about the runtime behavior of `dorny/paths-filter@v3` under specific GitHub event contexts:

1. **Round 1 (caught in PR #346 CI)**: `dorny` calls the GitHub REST API `listFiles(pull_number=…)` on `pull_request` events. The default `GITHUB_TOKEN` lacked `pull-requests: read`, so the PR-event check run failed with `Resource not accessible by integration` while the push-event check run passed. Fixed by adding `permissions: pull-requests: read` to the `docker-build` job.
2. **Round 2 (caught after PR #346 merged to main)**: `dorny` with `base: HEAD~1` on `workflow_run` events tries to anchor a merge-base against the default branch ref (`main`). Under the `ref: <head_sha>` detached-HEAD checkout this job uses, `main` isn't a local ref, so `git merge-base HEAD~1 main` exits 128. Fixed by replacing the dorny step in `deploy.yml` with a direct `git diff --name-only HEAD~1 HEAD` shell step + regex skip pattern.

Both bugs share a root cause: `dorny` has different code paths per event type that I did not pre-walk during Phase 1 scoping. Phase 5 YAML parse + structural AST check is necessary but not sufficient for workflow changes — actual GitHub event semantics are only exercised post-push.

## Architectural Impact

**Has Architectural Impact**: No.

`docs/architecture/architecture.md` does not document the CI/CD pipeline (covers app/service topology only — same precedent as the #166 retrospective). YAML-only change; no new system layer, component, interface, or ADR-worthy decision.

The Round 2 fix actually *reduced* a third-party-action dependency on `deploy.yml` — that file no longer uses `dorny/paths-filter`. `ci.yml` still uses it for the push/pull_request event combination, where it works correctly.

## Timeline of Events

### Phase 1: implement-scoping
- ✅ Read project_rules.md, FRAIM constitution, issue #343 body. Issue body was complete enough to skip spec/design.
- ✅ Pattern discovery: only two workflow files; existing `workflow_run` head_sha trap noted from prior #166 work; no constants file or shared config affected.
- ✅ Work-list at `docs/evidence/343-implement-work-list.md` with goals, skip set, D-S343.1..5 decisions, validation requirements (no UI / no mobile / Rule 11 smoke gates).
- ❌ **Did not** pre-read `dorny/paths-filter`'s README to understand its push-vs-PR-vs-workflow_run event-type behavior. This omission seeded both Round 1 and Round 2 bugs.

### Phase 3: implement-tests
- ⏭️ Justifiably skipped. No unit-test surface for `.github/workflows/*.yml` in this repo; same precedent as #166 (`workflow_run` and `concurrency` semantics only exercised by real branch pushes).

### Phase 4: implement-code
- ✅ `ci.yml` `docker-build`: paths-filter step + skip-message + `if:` on 6 build/verify steps.
- ✅ `deploy.yml` `build-and-deploy`: `fetch-depth: 2` on checkout, paths-filter with `base: HEAD~1`, skip-message, `if:` on all 12 build/deploy/verify steps.
- ❌ Did not add `permissions: pull-requests: read` to `docker-build` — defaulted to the workflow-level (empty) permissions, which silently dropped that scope on PR events.

### Phase 5: implement-validate
- ✅ YAML parse via `python -c "yaml.safe_load(...)"` (installed pyyaml on demand — js-yaml not in the fresh worktree's npm install).
- ✅ Structural AST count: `ci` job 14 steps / 0 gated; `docker-build` 9 / 7 gated; `build-and-deploy` 15 / 13 gated.
- ✅ Rule 11 local gates: typecheck PASS (after `pnpm db:generate` to populate `@prisma/client` in the fresh worktree), lint 0 errors / 6 pre-existing warnings, build PASS (12 packages), test:smoke PASS (16 packages, 460 API tests).
- ❌ **Phase 5 cannot exercise GitHub event-context behavior.** Both Round 1 and Round 2 bugs went through Phase 5 green. The lesson: when the only realistic test surface for a change is GitHub Actions itself, Phase 5 validates *shape*, not *behavior*.

### Phase 6: implement-security-review
- ✅ Diff scope = config-only. Threat surface classification returned empty set; all OWASP categories N/A. New action `dorny/paths-filter@v3` vetted — reputable maintainer, consistent with repo's major-version-pinning convention. 0 findings.

### Phase 7: implement-regression
- ✅ `pnpm test` PASS across all 17 packages.

### Phase 8: implement-quality
- ✅ 1 MINOR finding: skip-list duplicated verbatim between the two workflow files. Pre-disposed in issue body §"Out of scope" (the user approved keeping it inline until a 3rd workflow appears). Not agent-self-resolved.

### Phase 9: implement-completeness-review
- ✅ Feature Requirement TM: 7/7 Met. Technical Design TM: 6/6 Met. No `Partial`, no `Unmet`, no unresolved named callouts.

### Phase 10: implement-architecture-update
- ⏭️ No change.

### Phase 11: implement-submission
- ✅ Branch `feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits`, commit `560786c`, PR #346.

### Phase 12: address-feedback — Round 1 (`pull-requests: read`)
- ❌ → ✅ User asked: *"Why does CI say failed? It didn't run Deploy as expected, but should it not succeed?"*
- Diagnosis: `Build production images` on PR-event run failed with `Resource not accessible by integration` while the push-event run succeeded. `dorny/paths-filter@v3` uses `git diff` on push events but `listFiles(pull_number=…)` REST API on pull_request events.
- Fix in `04bc6cb`: added per-job `permissions: { contents: read, pull-requests: read }` to `docker-build`.
- Re-validation: all 4 PR checks green; user merged at `7909d52`.

### Phase 12: address-feedback — Round 2 (`deploy.yml` git exit 128)
- ❌ → ✅ User reported after PR #346 merge: *"Deploy failed Run dorny/paths-filter@v3 / Get current git ref / Changes will be detected between HEAD~1 and main / Searching for merge-base HEAD~1...main / Error: The process '/usr/bin/git' failed with exit code 128"*.
- Diagnosis: dorny on `workflow_run` events resolves the default branch ref to anchor a merge-base call, even when `base: HEAD~1` is explicit. Under detached-HEAD checkout by SHA, `main` isn't a local ref, so `git merge-base HEAD~1 main` exits 128.
- Prod impact: zero. The failure stopped ACR build before any push, so prod stayed on pre-#346 images. But every subsequent commit to main would have failed at the same step.
- Fix in PR #348 (commit `26f84e7`): replaced `dorny/paths-filter@v3` in `deploy.yml` with a 12-line `shell: bash` step using `git diff --name-only HEAD~1 HEAD` + regex skip pattern. Same outputs (`steps.changes.outputs.build`), no third-party action, no merge-base resolution required. `ci.yml`'s dorny step kept (push + pull_request work correctly).
- Pre-merge: smoke-tested the skip regex against 5 representative changesets (doc-only, mixed, code-only, workflow-edit, asset-in-code) — all correct. Rule 11 gates green.
- Post-merge end-to-end validation on commit `1b3ba02`: CI green, Deploy ran the new shell filter, logged `"Result: at least one non-doc file changed; deploy required."`, full ACR build + Container Apps update + `API health check passed`. **First successful deploy since #334 merged.**

### Phase 13: retrospective
- This document.

## Root Cause Analysis

### 1. Primary cause — did not pre-walk `dorny/paths-filter`'s event-type behavior in Phase 1
**Problem**: GitHub Actions actions often have different runtime code paths per event type (`push`, `pull_request`, `workflow_run`, `schedule`, …). `dorny/paths-filter` is one such action: it uses local `git diff` on push events, the REST API on PR events, and merge-base resolution on `workflow_run` events. Each path has different prerequisites (history depth, token scopes, branch refs locally). I did not read this in Phase 1 scoping, did not document it in the work-list as a risk, and did not write the implementation defensively against any of those paths.
**Impact**: Two latent bugs shipped to PR open. Round 1 (Permission) was caught by the PR check run that fires on `pull_request` events. Round 2 (merge-base) was caught only after merge to main, when `workflow_run` fired for real. Total cost: 2 fix-iterations + lost time.

### 2. Contributing factor — Phase 5 validates shape, not behavior, for GitHub Actions changes
**Problem**: My Phase 5 step parsed YAML, counted gated steps, and ran local Rule 11 gates. None of those exercise GitHub event-context behavior.
**Impact**: Both Round 1 and Round 2 bugs went through Phase 5 green. There is no Phase-5-equivalent surface that simulates a live `pull_request` token scope or a live `workflow_run` checkout. The mitigation has to be at Phase 1 (anticipate event-type pitfalls) or Phase 12 (one round of post-merge feedback is the de facto test).

### 3. Contributing factor — initial design used a third-party action where a shell one-liner would have sufficed
**Problem**: `deploy.yml`'s diff need is dead-simple: "give me the changed files between this main commit and its parent." That's literally one `git diff --name-only HEAD~1 HEAD`. Using `dorny/paths-filter` for that case brought in the merge-base behavior I didn't want and didn't need.
**Impact**: Round 2 fix. The shell version is 12 lines, has explicit logging, no merge-base resolution, no token-scope concerns. It's now the canonical shape for any future `workflow_run`-style filter on this repo.

## What Went Wrong

1. **Permission gap missed at Phase 5** (Round 1). See RCA §1 and §2.
2. **Merge-base resolution gap missed at Phase 5** (Round 2). Same root as #1.
3. **Monitor v1 silently broken**: my first PR-check monitor piped JSON through external `jq`, which isn't installed in this Git Bash environment. Every poll printed "jq: command not found" to stderr and the loop spun silently for the full CI cycle. Caught and replaced with a `gh --jq`-based monitor for the post-fix runs.
4. **prep-issue.sh used npm not pnpm**: the script ran `npm install` instead of `pnpm install --frozen-lockfile`, modifying `package-lock.json` by 1687 lines. Had to `git restore package-lock.json` before commit on every worktree. Recurring across Slice 3 / #343 / #347 / #349.
5. **Prisma client regen needed on fresh worktree**: Phase 5 typecheck failed initially on `apps/web/src/lib/mcp-oauth.ts` with implicit-`any` errors. `pnpm db:generate` resolved it. Same workaround as Slice 3 (already in the Slice 3 retro).

## What Went Right

1. **Skip-list-over-whitelist was the user's correction in real time.** Their pushback on the issue body's original whitelist proposal (and the misleading `.png`/`.jpg` entries in the skip set) reframed the design before any code was written. The failure direction is now correct: under-build = real bug (whitelist failure mode); over-build = recoverable annoyance (skip-list failure mode).
2. **Self-test in the PRs themselves.** Both #346 and #348 touched `.github/workflows/**` (not in skip set), so each PR's `docker-build` and `build-and-deploy` correctly resolved `build=true` and ran the full path — exercising the filter wiring end-to-end pre-merge.
3. **Phase 5 YAML parse via Python** worked as a substitute for js-yaml under time pressure. Installed `pyyaml` on demand. Adequate for shape validation.
4. **Monitor v2 worked.** Switched from external-`jq` pipe to `gh pr checks --jq` (uses gh's bundled jq). 60s polls, transition-only output. Fired cleanly through `pending → pass` on both #346 and #348.
5. **Round-2 fix turned over fast.** Feedback received → root cause identified → shell-step alternative chosen → pre-merge smoke-test of regex against 5 changesets → push → re-validation green → user merged → post-merge deploy success on the same merge commit. Single iteration, no regressions.
6. **Post-merge deploy on `1b3ba02` was the first prod deploy in 3 hours.** Production stayed safe throughout (no broken images shipped), and the new deploy contained the workflow fix + everything since #334 — clean catch-up.

## What I Almost Did Wrong But Caught

1. **Almost committed Phase 13 retrospective directly to main.** The previous Slice 3 retrospective (`7def500`) was committed directly to `main`, which violated Rule 10. This time, I filed a chore issue (#349) + branch + PR for the retrospective + work-list deletion. Caught because the user explicitly cited Rule 10 last session and a memory + coaching moment now enforce it.
2. **Almost left `package-lock.json` in the implementation commits.** prep-issue.sh modified it via `npm install` on both #343 and #347 worktrees; `git status` flagged it each time; `git restore` before staging kept both PRs clean.
3. **Almost trusted Phase 5 green as "done".** Round 1 reminded me that for workflow YAML changes, Phase 5 is necessary but not sufficient. Updated mental model for Round 2 (and proactively chose the simpler shell-step approach there, which avoids the next class of dorny event-type bug entirely).
4. **Almost echoed comments from PR #346 that don't exist.** Before drafting this retrospective, the user said they had "reflected the same in the comments in #346 PR". I checked REST inline, REST issue, and GraphQL review threads — all returned 0 comments. Surfaced the discrepancy in chat rather than fabricating comment content. The user can amend the PR if real comments appear.

## Where Past Learnings Actually Fired

1. **`feedback_show_artifact_before_publishing.md`** (written earlier in this session): fired before this PR — drafted issue body in chat for user review before `gh issue create` and showed retrospective body for review before push. Also fired before the deploy.yml fix PR (#348): showed the YAML diff and asked for "go" before any commit.
2. **`feedback_phase_8_findings_are_decisions.md`**: fired during Phase 8 — surfaced the skip-list-duplication MINOR finding for the user instead of self-marking "Accepted with Rationale". Disposition was already in the issue body, so no new decision was needed, but the rule kept me honest.
3. **Rule 10 (project_rules.md)**: actively followed throughout the session. Every code commit (Round 0 #346, Round 2 #348, this retro #349) went through a feature branch tied to a GitHub issue. Zero direct-to-main commits.

## Lessons Learned

1. **For GitHub Actions changes, read the action's event-type behavior before coding.** Workflow actions often have different code paths for `push` / `pull_request` / `workflow_run` / `schedule`, each with different token-scope and runtime characteristics. Phase 1 (scoping) for any workflow change should include a mandatory step: read the action's README section on event triggers and document any per-event prerequisites in the work-list.
2. **Phase 5 (validate) for workflow changes is structurally limited.** YAML parse + AST counts catch syntax / wiring errors, not permission / event-context errors. Plan for one or two rounds of post-PR feedback when the only realistic test surface is GitHub Actions itself. Don't claim "validated" beyond shape.
3. **Prefer a shell `git diff` step over a third-party action for the simple `workflow_run` diff case.** The mental model is cleaner, the failure modes are visible in the log (the `echo` lines we now have), and there's no merge-base or token-scope hidden complexity. Reserve third-party actions for cases where they actually add value (e.g., `ci.yml`'s push/pull_request combination, where dorny's listFiles fallback is real value).
4. **Poll monitors should self-test on first iteration.** If a monitor stays silent for longer than the longest reasonable single iteration, assume it's broken, not patient. Echo the first observed state to stdout to confirm filter + pipeline are working. (Already in operation for monitors v2 and v3 this session.)
5. **Fresh worktrees on this project need a known dance:** `pnpm install --frozen-lockfile` (not npm), `pnpm db:generate` (for Prisma types), and a `git restore` for anything `prep-issue.sh`'s `npm install` step dirtied. Recurring across Slice 3, #343, and #347 — worth a `prep-issue.sh` script fix upstream (see follow-ups).
6. **Production stays safe when the failure mode is "no deploy".** Round 2's `deploy.yml` regression failed before any push to ACR or any Container App update, so prod stayed on pre-#346 images while the fix was in flight. Important to recognize: a CI/CD failure that *prevents* a deploy is much safer than a CD success that *makes* a bad deploy. Bias future CI/CD changes toward the former failure mode.

## Agent Rule Updates Made to avoid recurrence

None new in this session. Existing memories that govern this work and fired correctly:
- [[feedback-show-artifact-before-publishing]] — fired before every external write in this session (`gh issue create`, `gh pr create`, retrospective file write).
- [[feedback-phase-8-findings-are-decisions]] — fired at Phase 8 of the implementation.
- Rule 10 (`fraim/personalized-employee/rules/project_rules.md`) — fired throughout (worktree + branch + PR for every code commit).

## Enforcement Updates Made to avoid recurrence

1. **Phase 1 scoping addition for workflow changes**: when the diff touches `.github/workflows/**`, the work-list must enumerate which events trigger each affected workflow and list any per-event prerequisites of any third-party actions in use. Operational rule for the next workflow PR; no FRAIM-job change required.
2. **prep-issue.sh upstream issue**: candidate to file against `mathursrus/FRAIM` proposing `prep-issue.sh` default to `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` exists. Tracked in §Open follow-ups; not blocking.
3. **No new ADRs / architecture-doc entries** — CI/CD pipeline remains outside `architecture.md` scope; consistent with #166 precedent.

## Open follow-ups (not blocking)

- **prep-issue.sh script** — pnpm-lock vs npm-lock detection improvement, plus optional `pnpm db:generate` step for projects using Prisma. File against `mathursrus/FRAIM`.
- **Reusable workflow for skip-list** — promote to `.github/workflows/_doc-only-filter.yml` (or use a composite action) when a 3rd workflow needs the same skip set. Issue #343 body §"Out of scope" tracks this.
- **Real-world skip-path validation** — confirmed live by `1b3ba02` deploy run (full path). The next doc-only commit to `main` will be the first real-world test that the `build=false` skip path actually short-circuits the deploy. Watch the next retrospective / RFC merge for it; this very PR (#349 retrospective + work-list cleanup) will be one such test.
