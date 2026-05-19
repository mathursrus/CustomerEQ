---
author: manohar.madhira@outlook.com
date: 2026-05-12
synthesized: 2026-05-14
---

# Postmortem: CI/CD — skip image build + deploy on doc-only commits — Issue #343

**Date**: 2026-05-12
**Duration**: ~1 conversational session, ~5 hours wall-clock end-to-end (issue file → first PR merge → three regression cycles → first successful build=true deploy → first successful build=false skip → retrospective). Three rounds of post-merge feedback, not the two originally documented.
**Objective**: Gate `.github/workflows/ci.yml` `docker-build` and `.github/workflows/deploy.yml` `build-and-deploy` so doc-only commits skip the ~17 min image build and the ~5–10 min ACR build + Container Apps rolling redeploy. Keep the `ci` job (typecheck/lint/build/test/audit) unfiltered.
**Outcome**: SUCCESS, after **three** regression cycles. Initial PR #346 (merge `7909d52`) shipped with three latent bugs (not two); each surfaced after a successive round of merges and was fixed in a follow-up PR. End-to-end validation: the merge of PR #352 (`eb64cf63`) produced the first deploy that actually proved both filters work in the `build=true` direction. The `build=false` path is still pending its first live exercise (the PR that lands this retrospective will be it).

## Executive Summary

A small two-file CI/CD change that the FRAIM Phase 5 validation showed as green but that had **three** bugs hiding behind it, all about the runtime behavior of `dorny/paths-filter@v3` under specific GitHub event contexts AND about YAML / glob-pattern semantics I didn't pre-walk:

1. **Round 1 (caught in PR #346 CI)**: `dorny` calls the GitHub REST API `listFiles(pull_number=…)` on `pull_request` events. The default `GITHUB_TOKEN` lacked `pull-requests: read`, so the PR-event check run failed with `Resource not accessible by integration` while the push-event check run passed. Fixed by adding `permissions: pull-requests: read` to the `docker-build` job.
2. **Round 2 (caught after PR #346 merged to main)**: `dorny` with `base: HEAD~1` on `workflow_run` events tries to anchor a merge-base against the default branch ref (`main`). Under the `ref: <head_sha>` detached-HEAD checkout this job uses, `main` isn't a local ref, so `git merge-base HEAD~1 main` exits 128. Fixed in PR #348 by replacing the dorny step in `deploy.yml` with a direct `git diff --name-only HEAD~1 HEAD` shell step + regex skip pattern.
3. **Round 3 (caught after PR #348 merged + first real doc-only commits hit main)**: TWO bugs at once.
   - **Bug 3A (both workflows)**: `Skip if doc-only` had `run: echo "...(issue #343)."` — YAML parses `#343` as the start of an inline comment, truncating the value at `#`. Bash receives an unterminated string and exits 2 on every doc-only commit. Fixed in PR #352 by switching to a literal block scalar (`run: |`) and dropping `#` from the message text as defense-in-depth.
   - **Bug 3B (`ci.yml` only)**: `dorny`'s skip-list was all-negative patterns. dorny uses last-match-wins semantics and needs a positive seed pattern (`'**'`) for negations to subtract from. Without it, dorny defaulted to `build=true` for every change — making the skip path unreachable. PR #350 was the first doc-only PR through the new filter and surfaced this: build steps ran while `Skip if doc-only` was skipped (gated on `build='false'`). Fixed in PR #352 by prepending `'**'` to the patterns list and adding `scripts/verify-paths-filter.py` as a pre-merge validator.

All three rounds share one root cause: I did not pre-walk action / parser / glob behavior during Phase 1 scoping. Phase 5 YAML parse + structural AST check is necessary but not sufficient for workflow changes — actual GitHub event semantics, YAML special characters, and dorny pattern resolution are only exercised post-push. The `scripts/verify-paths-filter.py` validator added in PR #352 is the operational mitigation: any future workflow-filter change must add a test case and pass it before push.

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

### Phase 12: address-feedback — Round 3 (YAML `#` truncation + dorny all-negative filter)

Surfaced by the user after PR #348 merge + the first real doc-only commits hit main. **Two distinct bugs in one round**:

#### Bug 3A — YAML `#` truncation in `Skip if doc-only` (both workflows)

- ❌ → ✅ User reported: *"I merged 2 doc only PRs, both failed the deploy step"*.
- Diagnosis: deploy run `25769843329` on commit `7e83b076` showed `/home/runner/work/_temp/...sh: line 1: unexpected EOF while looking for matching '"'`. The `Skip if doc-only` step had `run: echo "Doc-only change; ...(issue #343)."` — YAML parses `#343` as the start of an inline comment, truncating the `run:` value. Bash receives an unterminated string and exits 2.
- Latent in both `ci.yml` and `deploy.yml`. Surfaced first on `deploy.yml` because PR #348 fixed Round 2 there; remained latent on `ci.yml` because Bug 3B kept the skip path unreachable.
- Prod impact: zero. The failure occurred *before* any ACR push or Container App update, so prod stayed on the last successfully-deployed images.
- Fix in PR #352 (`301bb25`): switched both `Skip if doc-only` steps to literal block scalar (`run: |`), which preserves the value verbatim — no `#` interpretation. Also dropped `#` from message text (`issue #343` → `issue 343`) as defense-in-depth against a future single-line refactor reintroducing the bug.

#### Bug 3B — `dorny/paths-filter@v3` all-negative filter returns `build=true` (`ci.yml` only)

- ❌ → ✅ Surfaced by inspecting PR #350's CI step status: `Skip if doc-only` was skipped (gated on `build='false'`) while all six build steps ran. The filter resolved `build=true` on a doc-only diff.
- Diagnosis: dorny uses last-match-wins semantics and needs a positive seed pattern to define the universe of matchable paths. With only `!`-prefixed patterns, dorny has no baseline to subtract from and defaults to `build=true` for every change — making the skip path structurally unreachable. This is a documented dorny behavior I did not pre-walk.
- Fix in PR #352 (`301bb25`): prepend `'**'` positive pattern to the filter. Last-match-wins then correctly subtracts the negation patterns from the universal match set.

#### Round 3 pre-merge validation (new pattern going forward)

Added `scripts/verify-paths-filter.py`:
- Loads the patterns from `ci.yml` and asserts the first pattern is `'**'` (regression guard for Bug 3B class).
- Runs the matcher against 10 representative changesets using gitignore-style globs (same semantics as dorny/picomatch). 10/10 pass:

| # | Changeset | Expected `build` |
|---|---|---|
| 1 | doc-only .md under docs/ | false ✓ |
| 2 | README.md at repo root | false ✓ |
| 3 | CODEOWNERS + .gitattributes + LICENSE | false ✓ |
| 4 | .github/ISSUE_TEMPLATE/ + pull_request_template.md | false ✓ |
| 5 | apps + docs (mixed) | true ✓ |
| 6 | apps + Dockerfile + package.json (code) | true ✓ |
| 7 | .github/workflows/ci.yml (workflow edit) | true ✓ |
| 8 | apps/web/public/logo.png (asset-in-code) | true ✓ |
| 9 | docs/screenshot.png (asset-in-doc) | false ✓ |
| 10 | packages/database/prisma/migrations/...sql | true ✓ |

Post-merge end-to-end validation on commit `eb64cf63` (PR #352): full deploy ran (touches `.github/workflows/**` + `scripts/**`, both filters resolved `build=true`), Container Apps updated, `API health check passed` — first complete proof that the `build=true` path works end-to-end. The `build=false` path will be exercised by the merge of PR #350 (the PR that lands this retrospective; it is doc-only).

### Side incident — `gh pr merge --delete-branch` auto-closed unrelated PR #340

Surfaced two days later when the user investigated why their Slice 4a PR was closed. Timeline:

- `2026-05-12T20:37:37Z` — PR #334 merged with `gh pr merge 334 --squash --delete-branch`. The `--delete-branch` flag deleted the remote `feature/241-slice-3-surveys-list`.
- `2026-05-12T20:41:11Z` — GitHub fired `base_ref_deleted` event on PR #340 (whose base was `feature/241-slice-3-surveys-list`).
- `2026-05-12T20:41:12Z` (one second later) — GitHub auto-closed PR #340 because its base branch no longer existed.

The user initially attributed the close to PR #342's merge 3.5 hours later (its body referenced #340), but the event log proves the cause was `--delete-branch` on the #334 merge. GitHub does not allow reopening a PR whose base branch is gone, even after the base is recreated — confirmed by attempting `gh pr edit 340 --base main` + `gh pr reopen 340`, both rejected with `GraphQL: Could not open the pull request` and `Cannot change the base branch of a closed pull request`. Remediation: opened PR #353 from the same head against `main` as the new base; PR #340 stays closed for reference history.

### Phase 13: retrospective
- This document. Updated mid-stream to include Round 3 and the `--delete-branch` side incident before the PR that lands it (PR #350) merges.

## Root Cause Analysis

### 1. Primary cause — did not pre-walk action / parser / glob behavior in Phase 1

**Problem**: Three classes of behavior I did not pre-read before coding:
- **Action event-type code paths** — `dorny/paths-filter` uses local `git diff` on push events, REST API on PR events, and merge-base resolution on `workflow_run` events. Each path has different prerequisites (history depth, token scopes, branch refs locally). Rounds 1 + 2 root cause.
- **YAML special characters in `run:` scalar values** — `#` starts an inline comment in single-line scalars, truncating values at the first unescaped occurrence. Round 3A root cause. Should have caught this from project-rules R10 / general YAML knowledge — `#343` in `run: echo "..."` is parser-poison.
- **Glob-pattern matcher semantics** — `dorny/paths-filter` uses last-match-wins and requires a positive seed pattern; all-negation lists default to "include everything". Round 3B root cause. Documented in dorny's README pattern-matching section, which I didn't read in Phase 1.

**Impact**: Three latent bugs shipped to PR open. Each surfaced only when a specific event/path combination ran against real GitHub Actions runtime — never at any local validation step.

### 2. Contributing factor — Phase 5 validates shape, not behavior, for GitHub Actions changes

**Problem**: My Phase 5 step for #343 parsed YAML, counted gated steps, and ran local Rule 11 gates. None of those exercise: live GitHub event-context behavior, YAML string content interpretation through bash, or matcher pattern semantics.

**Impact**: All three rounds of bugs went through Phase 5 green. PR #352 added `scripts/verify-paths-filter.py` to close the matcher-semantics gap (Round 3B class); the event-context (Rounds 1, 2) and YAML-string (Round 3A) gaps remain open — see §Lessons Learned for the Phase-1 mitigation.

### 3. Contributing factor — initial design used a third-party action where a shell one-liner would have sufficed

**Problem**: `deploy.yml`'s diff need is dead-simple: "give me the changed files between this main commit and its parent." That's literally one `git diff --name-only HEAD~1 HEAD`. Using `dorny/paths-filter` for that case brought in the merge-base behavior I didn't want and didn't need.

**Impact**: Round 2 fix (PR #348). The shell version is 12 lines, has explicit logging, no merge-base resolution, no token-scope concerns. It's now the canonical shape for any future `workflow_run`-style filter on this repo.

### 4. Contributing factor — `gh pr merge --delete-branch` side-effect on PRs whose base is the deleted branch

**Problem**: I merged PR #334 with `gh pr merge 334 --squash --delete-branch`. The flag deleted the remote `feature/241-slice-3-surveys-list`, which was the base branch of an unrelated in-flight PR (#340). GitHub auto-closed #340 one second after the branch deletion event. The close is irreversible — GitHub blocks `gh pr reopen` on PRs whose base is gone, even after the base is recreated.

**Impact**: PR #340 closed with no warning, no reviewer signal. The user discovered it later when their Slice 4a work appeared to have vanished from the open-PR list. Remediation cost: ~10 min to diagnose the actual cause (initially misattributed to PR #342's body reference), open replacement PR #353, and lose the original PR's discussion thread continuity.

**Root cause**: I did not check for in-flight PRs against the about-to-be-deleted base branch before passing `--delete-branch`. The flag's semantics are obvious in isolation; its blast-radius across other PRs is not, until you've been bitten.

## What Went Wrong

1. **Permission gap missed at Phase 5** (Round 1). See RCA §1 and §2.
2. **Merge-base resolution gap missed at Phase 5** (Round 2). Same root as #1.
3. **YAML `#` truncation in `Skip if doc-only` run-scalar** (Round 3A). See RCA §1. Affected both workflows; failed live on every doc-only main commit until PR #352.
4. **dorny all-negative skip-list returns `build=true`** (Round 3B). See RCA §1. Made the skip path structurally unreachable; surfaced when PR #350 was the first doc-only PR through the new filter and the build steps ran while `Skip if doc-only` was skipped.
5. **`--delete-branch` on PR #334 merge auto-closed unrelated PR #340.** See RCA §4. Side incident; lost ~10 min and PR #340's discussion thread.
6. **Monitor v1 silently broken**: my first PR-check monitor piped JSON through external `jq`, which isn't installed in this Git Bash environment. Every poll printed "jq: command not found" to stderr and the loop spun silently for the full CI cycle. Caught and replaced with a `gh --jq`-based monitor for the post-fix runs.
7. **prep-issue.sh used npm not pnpm**: the script ran `npm install` instead of `pnpm install --frozen-lockfile`, modifying `package-lock.json` by 1687 lines. Had to `git restore package-lock.json` before commit on every worktree. Recurring across Slice 3 / #343 / #347 / #349 / #351.
8. **Prisma client regen needed on fresh worktree**: Phase 5 typecheck failed initially on `apps/web/src/lib/mcp-oauth.ts` with implicit-`any` errors. `pnpm db:generate` resolved it. Same workaround as Slice 3 (already in the Slice 3 retro).

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

1. **For GitHub Actions changes, read the action's event-type behavior AND its matcher semantics before coding.** Phase 1 (scoping) for any workflow change should include a mandatory step: read the action's README section on event triggers and pattern matching, then document any per-event / per-pattern prerequisites in the work-list. The three #343 rounds each hit a different facet of this — event-type code paths (R1, R2), and matcher semantics (R3B).
2. **YAML `#` in a single-line `run:` scalar will truncate at the comment marker.** When the message text needs to contain `#`, either: (a) use a literal block scalar (`run: |`), (b) wrap the value in single quotes, or (c) escape / remove the `#`. R3A bit us; the literal-block-scalar form is the canonical safe fix.
3. **Phase 5 (validate) for workflow changes is structurally limited.** YAML parse + AST counts catch syntax / wiring errors, not permission / event-context errors, not matcher semantics, not YAML special-character interpretation through bash. Plan for one or two rounds of post-PR feedback when the only realistic test surface is GitHub Actions itself. The new `scripts/verify-paths-filter.py` (PR #352) closes the matcher-semantics gap by running the same pattern semantics dorny does, against representative changesets — any future workflow-filter change must extend this script.
4. **Prefer a shell `git diff` step over a third-party action for the simple `workflow_run` diff case.** The mental model is cleaner, the failure modes are visible in the log (the `echo` lines we now have), and there's no merge-base or token-scope hidden complexity. Reserve third-party actions for cases where they actually add value (e.g., `ci.yml`'s push/pull_request combination, where dorny's listFiles fallback is real value).
5. **`gh pr merge --delete-branch` has cross-PR blast radius.** Before passing `--delete-branch`, `gh pr list --base <branch-about-to-be-deleted>` to enumerate in-flight PRs that will be auto-closed by the GitHub side-effect (irreversibly — base-recreate doesn't unlock reopen). If any exist, either change their base first or merge without `--delete-branch` and let the user delete manually.
6. **Poll monitors should self-test on first iteration.** If a monitor stays silent for longer than the longest reasonable single iteration, assume it's broken, not patient. Echo the first observed state to stdout to confirm filter + pipeline are working. (Already in operation for monitors v2 and v3 this session.)
7. **Fresh worktrees on this project need a known dance:** `pnpm install --frozen-lockfile` (not npm), `pnpm db:generate` (for Prisma types), and a `git restore` for anything `prep-issue.sh`'s `npm install` step dirtied. Recurring across Slice 3, #343, #347, and #351 — worth a `prep-issue.sh` script fix upstream (see follow-ups).
8. **Production stays safe when the failure mode is "no deploy".** Rounds 2 and 3A's `deploy.yml` regressions failed before any push to ACR or any Container App update, so prod stayed on pre-bug images while the fixes were in flight. Important to recognize: a CI/CD failure that *prevents* a deploy is much safer than a CD success that *makes* a bad deploy. Bias future CI/CD changes toward the former failure mode.

## Agent Rule Updates Made to avoid recurrence

None new in this session. Existing memories that govern this work and fired correctly:
- [[feedback-show-artifact-before-publishing]] — fired before every external write in this session (`gh issue create`, `gh pr create`, retrospective file write).
- [[feedback-phase-8-findings-are-decisions]] — fired at Phase 8 of the implementation.
- Rule 10 (`fraim/personalized-employee/rules/project_rules.md`) — fired throughout (worktree + branch + PR for every code commit).

## Enforcement Updates Made to avoid recurrence

1. **`scripts/verify-paths-filter.py` (PR #352)** — pre-merge dry-run of dorny's matcher against 10 representative changesets, plus a guard that asserts the first pattern in `ci.yml`'s filter is `'**'` (regression test for the all-negative bug). Any future workflow-filter change must add a test case and pass this script before push. This is the operational mitigation for the Phase-5-validates-shape-not-behavior gap; without it, Round 3B would have shipped again on the next workflow change.
2. **Phase 1 scoping addition for workflow changes**: when the diff touches `.github/workflows/**`, the work-list must enumerate (a) which events trigger each affected workflow, (b) per-event prerequisites of any third-party actions in use, (c) any matcher semantics or YAML special-character risk in `run:` scalars. Operational rule for the next workflow PR; no FRAIM-job change required.
3. **`gh pr merge --delete-branch` pre-check**: before passing the flag, run `gh pr list --base <branch>` to enumerate in-flight PRs. If any exist, either rebase them first via `gh pr edit <N> --base main` or merge without `--delete-branch` and delete the branch manually after confirming no other PR has it as a base. Operational rule; no FRAIM-job change required.
4. **prep-issue.sh upstream issue**: candidate to file against `mathursrus/FRAIM` proposing `prep-issue.sh` default to `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` exists. Tracked in §Open follow-ups; not blocking.
5. **No new ADRs / architecture-doc entries** — CI/CD pipeline remains outside `architecture.md` scope; consistent with #166 precedent.

## Open follow-ups (not blocking)

- **prep-issue.sh script** — pnpm-lock vs npm-lock detection improvement, plus optional `pnpm db:generate` step for projects using Prisma. File against `mathursrus/FRAIM`.
- **Reusable workflow for skip-list** — promote to `.github/workflows/_doc-only-filter.yml` (or use a composite action) when a 3rd workflow needs the same skip set. Issue #343 body §"Out of scope" tracks this.
- **Real-world `build=true` path** — confirmed live by `1b3ba02` (PR #348 merge) and `eb64cf63` (PR #352 merge) deploy runs. Both touched workflow / script files (not in skip set), full ACR build + Container Apps update + healthcheck passed.
- **Real-world `build=false` skip-path validation** — NOT yet exercised in production. PR #350 (this retrospective + work-list cleanup) is doc-only and will be the first such test when merged. Expected: `docker-build` short-circuits at `Skip if doc-only` (no image build); `deploy.yml` workflow_run guard step says "all changes match the doc-only skip set; skipping deploy" → no ACR build, no Container Apps update. If anything misbehaves, a Round 4 fix-PR will be needed.
- **Slice 4a re-PR (#353)** — PR #340 was auto-closed by GitHub when `gh pr merge 334 --delete-branch` deleted its base branch. Replaced by PR #353 (same head, base=main); PR #340 stays closed for reference. The `gh pr merge --delete-branch` pre-check (§Enforcement Updates #3) prevents recurrence.

---

## Correction (2026-05-15, per Rule 26)

§"What I Almost Did Wrong But Caught" item #1 (line 193 of this file at time of correction) reads:

> *"Almost committed Phase 13 retrospective directly to main. The previous Slice 3 retrospective (`7def500`) was committed directly to `main`, which violated Rule 10. This time, I filed a chore issue (#349) + branch + PR for the retrospective + work-list deletion. Caught because the user explicitly cited Rule 10 last session and a memory + coaching moment now enforce it."*

**This framing was wrong.** It encoded the fabrication that produced PR #350 as a "win," and would re-teach the wrong lesson to any future agent reading this retrospective.

The actual binary I treated as exhaustive was: *(a) commit retro to `main` (Rule 10 violation)* vs. *(b) file a new chore-issue + worktree + branch + PR for the retro*. I picked (b) and called it the fix.

The correct option I missed: **(c) push the retro commit to the parent issue's existing feature branch (`feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits`), open one PR off that branch, ride with the implementation PR's lifecycle.** This is the FRAIM default codified in **Rule 26 (One PR Per Phase Artifact)** added 2026-05-15 in PR #379. By that rule:
- Phase 13 retro + work-list cleanup is part of issue #343's lifecycle, not a new issue.
- Filing #349 + spawning a new worktree (`Issue 349`) for it was a Rule 26 violation, not a Rule 10 fix.
- The same applies to issues #347 and #351 — each was filed as a separate issue with its own worktree for what was post-merge follow-up on the same CI/CD workstream. PR #350's FRAIM section (line ~ at time of writing: *"the worktrees at Issue 343, Issue 347, Issue 349, Issue 351 can all be removed locally"*) was the on-record admission that one logical workstream became four worktrees.

**Future agents reading this retro:** §"What I Almost Did Wrong But Caught" item #1 is preserved for historical record but is **superseded** by this correction. The chore-issue split is the pattern Rule 26 was authored to extinguish. Do not replicate it.

Cross-references:
- Rule 26 in `fraim/personalized-employee/rules/project_rules.md`.
- Mistake-pattern entry "Fabricated 'chore-issue' framing to split phase artifacts across PRs" in `manohar.madhira@outlook.com-mistake-patterns.md`.
- Rejected-proposal entry "Phase 13 retro / coaching-moment capture / post-merge follow-up should be filed as its own 'chore-issue'" in `manohar.madhira@outlook.com-rejected-proposals.md`.
- Auto-memory `[[one-pr-per-phase-artifact]]`.
