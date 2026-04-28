---
author: manohar.madhira@outlook.com
date: 2026-04-25
synthesized: 2026-04-27
---

# Postmortem: Upgrade Node 20 → 22 in Dockerfiles (technical design) — Issue #177

**Date**: 2026-04-25
**Duration**: Single session
**Objective**: Author the technical design (RFC) for bumping the Node base image from 20 → 22 across all three Dockerfiles, the CI workflow, the engines floor, and the architecture/getting-started docs — covering full dependency audit and missing test cases per the user's request
**Outcome**: Success — RFC and evidence committed to PR #188, approved with one inline "Agreed" GitHub comment + three confirming chat decisions, zero requested changes

## Executive Summary

Authored `docs/rfcs/177-upgrade-node-22.md` and `docs/evidence/177-technical-design-evidence.md`. The RFC enumerates exactly eight Node-version surfaces in the worktree (Dockerfiles ×6 lines, `ci.yml` `node-version`, root `engines.node` + `@types/node`), classifies dependency-rebuild risk (zero direct native deps; transitive Prisma/Sharp/ioredis covered with rationale), and proposes a new `docker-build` CI job to validate the bump on PR rather than only on prod deploy. PR was approved on the first pass with no RFC edits required.

## Architectural Impact

**Has Architectural Impact**: Yes (proposed; updates land in implementation PR per FRAIM convention)

**Sections Updated** (proposed in RFC, not yet applied):
- `docs/architecture/architecture.md` §2 row 28 — the runtime row updates from `Node.js >= 20` to `Node.js >= 22` and gains a one-sentence LTS-tracking convention ("Track upstream Node LTS — bump within ~6 months of EOL"). User agreed via inline PR review comment + chat decision.
- `docs/getting-started.md` Prerequisites table row 11 — `Node.js | >= 20` → `Node.js | >= 22`, plus `nvm install 20` → `nvm install 22`.

**Rationale**: The architecture doc currently records the runtime as `Node.js >= 20` but does not state the LTS-tracking rule. Without it, the next bump (Node 22 → 24 ~April 2027) gets re-litigated from scratch. Bumping the engines floor in lockstep with the production Dockerfile prevents the silent-drift class of bug where contributors develop on Node 18/20 while the prod image is Node 22.

**Updated in PR**: Will be — implementation PR (not this design PR) per FRAIM's address-feedback / implementation phase split.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Loaded issue context**: Read GitHub issue #177 body — Proposed change + 5-row Validation checklist as the spec, no `docs/feature-specs/177-*.md`.
- ✅ **Loaded architecture context**: Read `docs/architecture/architecture.md` §1–§2 plus `fraim/personalized-employee/rules/project_rules.md`.
- ✅ **Studied prior FRAIM technical-design outputs**: Read `docs/evidence/157-technical-design-evidence.md` and the matching postmortem to understand the canonical RFC + evidence + traceability structure before authoring.
- ✅ **Ran two parallel codebase audits via Explore subagents**: One enumerating every Node-20 reference (8 surfaces found, zero native deps direct), the other auditing test coverage (CI does not build production Dockerfiles — biggest pre-existing gap).

### Phase 2: design-authoring
- ✅ **Decided no spike needed**: Node 22 has been GA for over a year; zero direct native deps; transitive natives (Prisma engine, Sharp, ioredis) all support Node 22 in the versions we ship. Recorded the rationale explicitly in the RFC's "Spike Findings" section.
- ✅ **Authored full RFC** covering Customer/Problem/UX/Technical Details (file inventory, dependency compatibility, CI/CD impact with proposed `docker-build` job, files NOT changed, failure modes), Confidence (90 with explicit reasoning), Validation Plan (7 rows), Test Matrix (with explicit out-of-scope rationale for pre-existing gaps), Risks & Mitigations (7 entries), Architecture Analysis (3-bucket), Architecture Updates (2 doc-only edits), Out of Scope.

### Phase 3: technical-spike
- ✅ **Skipped**: No technical uncertainty. Node 22 LTS is mature; deps support it.

### Phase 4: architecture-gap-review
- ✅ **Three-bucket classification appended to RFC**: 8 patterns Correctly Followed (architecture-doc-authoritative, validation gate, no-skipped-tests, multi-tenant N/A, event-driven N/A, ledger N/A, GDPR N/A, secrets N/A), 2 patterns Missing from Architecture (LTS upgrade cadence, single-source-of-truth for Node version), 0 Incorrectly Followed.

### Phase 5: design-completeness-review
- ✅ **Traceability matrix authored**: Mapped every line of the issue's Validation checklist (AC1–AC5) plus the implicit "Proposed change" requirement to specific RFC sections. All 6 rows Met.
- ✅ **Evidence file written**: `docs/evidence/177-technical-design-evidence.md` with traceability matrix + architectural-gaps subsection + Continuous Learning table.

### Phase 6: design-submission
- ✅ **Committed and pushed without pausing**: Commit `5f92cbc` on the existing feature branch (created earlier in the session by `prep-issue.sh 177`). Memory rule "Push + PR are standard flow; merges need GitHub review" — applied; no submission-strategy pause needed because the branch was clean (only the two new design docs) and there was no pre-existing PR on the branch.
- ✅ **PR opened**: PR #188, base `main`, head `feature/177-upgrade-node-20-22-in-dockerfiles-api-web-worker`. Description includes summary, deliverables, audit highlights, architectural gaps for reviewer, out-of-scope items, and a 4-item review checklist.
- ✅ **Labels applied to issue #177**: `phase:design`, `status:needs-review`. Discovered in the process that the documented "phase-label triggers PR auto-creation" workflow does not exist in this repo (only `CI` and `Deploy` workflows are configured) — created the PR manually via `gh pr create`.
- ✅ **Evidence-link comment posted on PR #188**.

### Phase 7: address-feedback
- ✅ **Reviewed PR comments and chat decisions**: One inline GitHub review comment ("Agreed") on the Architecture Updates section + a top-level "Reviewed" comment, plus three chat decisions confirming the RFC's defaults. All approval-style; zero requested changes; zero RFC edits needed.

### Phase 8: retrospective
- ✅ **This document**.

## Root Cause Analysis

Not applicable in the failure sense — the work succeeded on the first pass. The root-cause-style insight worth recording is structural:

### 1. **Documented PR-auto-creation path was missing**
**Problem**: `prep-issue.sh` printed "PR will be created when you apply a phase label to the issue (phase:spec, phase:design, phase:tests, or phase:impl)" but no GitHub Actions workflow exists in `.github/workflows/` to do that — only `CI` and `Deploy`.
**Impact**: Minor — caught during the submission phase by checking `gh pr list` after applying the label and seeing zero results. Created the PR manually via `gh pr create`. No work lost; ~30 seconds of confusion.

### 2. **Branch naming convention drift between FRAIM script and project rule**
**Problem**: `~/.fraim/scripts/prep-issue.sh` generates branch names as `feature/{issue}-{slug}` while `project_rules.md` rule #10 specifies `feature/issue-{N}-{slug}`. The FRAIM script wins because the user explicitly invoked it, and existing worktrees on disk follow the FRAIM convention.
**Impact**: Cosmetic only — branch names are functional. Worth flagging so the personalized rule memory and project rule #10 can be reconciled later (or accepted as the FRAIM-overrides-project-rule path).

## What Went Wrong

1. **None of consequence**. The work shipped clean on the first pass with zero requested RFC changes.

## What Went Right

1. **FRAIM-first discipline**: Per the recent coaching moment (`feedback_fraim_before_plan_mode`), I scanned job stubs, ran `prep-issue.sh` for issue preparation, then transitioned cleanly into `technical-design` once the user requested it. No plan mode, no Explore agents launched ahead of FRAIM context. The MCP tools weren't loaded initially, so I worked from prior evidence docs and the on-disk template until the FRAIM MCP server became available, then validated my approach via `seekMentoring` before authoring the evidence file.
2. **Parallel codebase audits**: Two Explore subagents ran in parallel — one for Node-20 reference inventory, one for test-coverage gaps. The two outputs combined to exactly the inputs the RFC needed (full surface enumeration + clear story on the "first Node 22 image build is prod deploy" gap). No back-and-forth, no missed surfaces.
3. **Audit produced an unexpected risk discovery**: The big finding wasn't the Node version itself (mechanical bump) but the fact that **CI does not build the production Dockerfiles**. Without surfacing that, a literal reading of the issue's validation checklist ("Build succeeds locally for all three images") would have called for a local-only build verification that does not protect the production deploy path. The RFC elevates `docker-build` in CI as a primary deliverable, not a side cleanup.
4. **Spike-skip rationale recorded explicitly**: Rather than just listing "Spike Findings: N/A," the RFC documented *why* — Node 22 GA for 12+ months, zero direct native deps confirmed by audit, transitive natives all support Node 22 in current versions. Future infra-bump RFCs can reuse this rationale shape.
5. **Out-of-scope items called out with reasons**: The Test Matrix explicitly lists three pre-existing test gaps (no e2e in CI, no real-Redis tests, no image-boot smoke) and explains why they're not addressed inside this PR — preventing scope creep on a security-driven update while leaving a clear breadcrumb for a follow-up issue.
6. **Decision points surfaced for the reviewer rather than buried**: The PR description ended with three explicit "Decisions for you" items (bundle vs. split docker-build, take cadence sentence vs. drop, bump engines floor vs. don't). User answered all three in one chat turn — fastest possible review feedback loop.
7. **No premature commit-and-push pattern**: Committed/pushed/labeled in one batch only after both docs were authored and FRAIM `seekMentoring` for `design-completeness-review` returned `complete`. No mid-flight pushes.

## What I Almost Did Wrong But Caught

1. **Almost ran `npm install` in the new worktree**: `prep-issue.sh` defaults to running `npm install` after creating the worktree. CustomerEQ is a pnpm/Turborepo workspace — running `npm install` would have created a `package-lock.json` that conflicts with `pnpm-lock.yaml`. Caught it before invoking the script and passed `--skip-install`, then ran `corepack pnpm install` manually in the worktree. This pattern is worth noting because `prep-issue.sh` is generic; any pnpm-based repo invoking FRAIM issue-preparation should pass `--skip-install`.
2. **Almost over-engineered the test-additions section**: My initial outline for the RFC included "add real-Redis integration test, add image-boot smoke, add e2e in CI" as primary deliverables. Caught it on second pass because the issue is a security-driven LTS bump and those three additions are pre-existing gaps that pre-date Node 22. Refactored into a "Pre-existing gap → Why not addressed here → Recommendation" table with one explicit follow-up issue recommendation. Kept the scope tight.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_before_plan_mode.md`**: First user message ("prepare for issue 177. Ensure you use FRAIM") — read the project rules, scanned job stubs, ran `prep-issue.sh`. No plan mode, no Explore agents until the job phases needed them. Outcome: full FRAIM job ran cleanly through 8 phases with zero rework.
2. **`feedback_dont_ask_about_baseline_dev_env`**: Did not ask the user about local DB, dev server, or `.env.example` setup — went straight from `prep-issue.sh` to `pnpm install` in the new worktree.
3. **`feedback_push_pr_always_merge_with_review`**: Committed + pushed + opened the PR + applied labels in the design-submission phase without pausing for explicit approval. The user's later "merges need GitHub review" half is the gate that comes later (implementation PR merge), not now.
4. **Project rule #4 (Architecture document is authoritative)**: Triggered when noticing `architecture.md:28` says `Node.js >= 20` but the Dockerfiles will say `node:22-slim`. Made the architecture-doc edit a primary RFC deliverable rather than implicit cleanup.
5. **Project rule #11 (Validation gate)**: Used implicitly when reasoning about safety of the engines-floor bump — `pnpm typecheck` will catch any `@types/node ^22` regression before merge.
6. **Project rule #15 (Fix at the right abstraction level)**: Triggered when seeing the Node version is hardcoded in 8 places. Resisted the urge to introduce a build-time templating mechanism in this RFC (overkill for N=8 with zero direct native deps); instead documented as a "patterns missing from architecture" gap and explicitly scoped it out, leaving the reviewer to decide whether to file a follow-up.
7. **Postmortem #157 lesson "When an existing PR is open on the current branch for a different workflow, surface the submission-strategy choice"**: Did not fire here because the branch was clean (no other PR), so there was no submission ambiguity to surface. The lesson generalizes to: *check before pushing, surface only when there's a real choice*.

## Lessons Learned

1. **For LTS-tracking infra bumps, the highest-leverage test addition is "build the prod image in CI."** Today CI builds source via Turbo but never exercises the Dockerfiles. The first Node-22 image build is the prod deploy job. Making the docker-build a CI step turns the highest residual risk into a normal CI failure on PR. This pattern generalizes to any base-image bump (Postgres, Redis, OS distro), not just Node.

2. **The audit *is* the validation for an LTS-tracking bump.** When the audit reports zero direct native deps, transitive natives all support the new version, and zero `process.version` checks, there is nothing to spike against. The "Spike Findings: N/A" outcome is correct — but the rationale must be recorded explicitly so future reviewers can confirm the skip rather than wondering why no PoC was built.

3. **Engine floor and Dockerfile base image are two halves of the same decision.** Today they are at `>=20.0.0` and `node:20-slim`. Without bumping both in lockstep, contributors can develop on Node 18/20 while the prod image is Node 22 and miss runtime regressions locally. The pattern: any base-image bump should consider whether `engines.{runtime}` should move with it.

4. **A "PR auto-created from phase label" assertion in tooling output should be verified, not assumed.** `prep-issue.sh` printed the assertion but no GHA workflow implements it in this repo. Cost was small (~30 seconds to discover and create the PR manually) but the lesson generalizes: when tooling makes a claim about external automation, check whether the automation exists before relying on it.

5. **Decision-points-at-the-bottom-of-the-PR-body is a high-leverage review pattern.** Three numbered decisions in the PR description got three answers in a single chat turn. Faster than waiting for inline GitHub review comments on each.

## Agent Rule Updates Made to avoid recurrence

1. **None new**: All learnings above are either already covered by existing rules and feedback memories or are situational rather than rule-worthy. Specifically:
   - Lesson 1 (build prod image in CI) is captured in this RFC's Risks table and Test Matrix; future infra-bump RFCs can reference it.
   - Lesson 2 (audit-as-validation for LTS bumps) is captured in the RFC's "Spike Findings" rationale.
   - Lesson 3 (engines + Dockerfile in lockstep) is captured in the RFC's Customer Problem section.
   - Lesson 4 (verify tooling assertions) is general engineering hygiene; no rule update warranted.
   - Lesson 5 (decision points at PR-body bottom) is a writing pattern; recording in the postmortem so future PRs reuse it.

## Enforcement Updates Made to avoid recurrence

1. **None**: No automated enforcement changes. Recommended for future consideration: a CI script that fails when `engines.node` and the `Dockerfile` Node version disagree (lightweight string check). Out of scope for this RFC.
