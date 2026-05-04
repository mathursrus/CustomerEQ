---
author: manohar.madhira@outlook.com
date: 2026-05-04
synthesized:
---

# Postmortem: BAML codegen ESM-friendly imports (implementation phase) — Issue #273

**Date**: 2026-05-04
**Duration**: ~1 hour from `implement-scoping` to `implement-submission`, including one CI failure round-trip and the `architecture.md` update
**Objective**: Implement the design approved in PR #275 — set `module_format "esm"` in BAML, add CI module-resolution probe, document the contract in `architecture.md`.
**Outcome**: Success — PR approved on first review pass; CI green on origin; ready for merge.

## Executive Summary

A 1-line production-code change (BAML config) plus 18 lines of CI yaml plus 20 lines of architecture-doc updates. CI surfaced one real bug (probe target imported by package name didn't resolve in `/app/[eval1]` context); fixed by switching to direct dist path. No reviewer feedback rounds needed.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/architecture.md` §3.8 (new — AI Layer / packages/ai) and §7.4 (extended — Validation Commands).

**Changes Made**:
- New §3.8 documents `packages/ai`'s build-time codegen pattern, gitignored generated client, the `module_format "esm"` contract that the BAML 0.211.0 codegen requires for Node 22 ESM, and BAML version pinning in two places (`package.json` + `generators.baml`).
- §7.4 now describes the built-image module-resolution probe as a CI gate, with the narrow-target rationale (probe `@customerEQ/ai`'s dist not the full app entry) and the CI-vs-CD complementary relationship.

**Rationale**: The `bdfadf0` commit (April 17) made BAML codegen-at-build-time an implicit contract without documenting it in architecture.md. That implicit contract is exactly what failed silently when `8fd2786`'s extension fix was wiped. Surfacing both the build-time pattern and the new CI gate in `architecture.md` ensures the next reviewer of `packages/ai` or the CI workflow knows the contracts they're working against.

**Updated in PR**: Yes — committed as `e3875ee` on the same branch.

## Timeline of Events

### Phase 1–4: scoping → repro → tests → code
- ✅ **Standing work list** at `docs/evidence/273-implement-work-list.md`. 3-file scope.
- ✅ **Repro**: ran `pnpm --filter @customerEQ/ai run generate` in worktree without the fix; grepped 5 extensionless imports. Bug reproduced.
- ✅ **Test strategy**: no new unit tests; the new CI probe steps are the integration test.
- ✅ **Code**: added `module_format "esm"` (commit `c9b1a58`); added two `Verify * image module resolution` steps + `load: true` to docker/build-push-action.

### Phase 5: implement-validate
- ✅ Worktree had to run `pnpm install` (prep-issue.sh ran `npm install` which doesn't set up pnpm workspace links) and `pnpm db:generate` to populate the prisma client; then everything green.
- ✅ Local: 0 extensionless imports across all 13 generated files; `pnpm typecheck` 17/17; `pnpm test:smoke` 14/14 (391 unit tests).
- ✅ Direct dist import resolves cleanly from inside the package directory.

### Phase 6: implement-security-review
- ✅ Threat surface classification: `[]` — diff is config + yaml + markdown. No web/api/llm-app/data-pipeline/mobile/capability-authoring files. 0 findings.

### Phase 7: implement-regression
- ❌ → ✅ **CI on commit `c9b1a58` failed**: probe step errored with `Cannot find package '@customerEQ/ai' imported from /app/[eval1]`. pnpm doesn't hoist workspace packages to `/app/node_modules`, so `node -e` running in `/app` couldn't resolve the package by name.
- ✅ **Fix at commit `8a846d6`**: switched probe to direct dist path `/app/packages/ai/dist/index.js`. Same scope, more reliable resolution. RFC + work list updated.
- ✅ **CI on `8a846d6`**: both probe steps + every other step green.

### Phase 8: implement-quality
- ✅ No hardcoded credentials. Two near-duplicate probe steps (api/worker) intentionally not consolidated to a matrix — at the threshold but not over it.

### Phase 9: implement-completeness-review
- ✅ Feature requirement traceability matrix: 4/4 acceptance criteria Met (2 with post-merge proof pending CD).
- ✅ Technical design traceability matrix: 8/8 RFC commitments Met.
- ✅ All feedback ADDRESSED.

### Phase 10: implement-architecture-update
- ✅ Added new §3.8 AI Layer (after §3.7 Embed Layer — no renumbering, preserves existing `§3.7` cross-ref in `docs/feature-specs/170-onboarding-first-run.md`).
- ✅ Extended §7.4 Validation Commands.

### Phase 11: implement-submission
- ✅ PR title updated to reflect impl scope. Impl-phase summary comment posted. Issue labels: `bug`, `phase:impl`, `status:needs-review`.

### Phase 12: address-feedback
- ✅ User approved on first pass. 0 feedback rounds in implementation phase.

## Root Cause Analysis

### 1. **Probe-target package-name miss (the one CI failure)**
**Problem**: Imported `@customerEQ/ai` by package name. The probe runs in `/app/[eval1]` context (a synthetic eval module path), and Node ESM walks up looking for `node_modules/@customerEQ/ai` from that path. With pnpm's workspace layout, `@customerEQ/ai` isn't symlinked at `/app/node_modules/`; only `apps/api/node_modules/@customerEQ/ai` exists. So resolution fails.
**Impact**: One CI run wasted (~7 minutes) before fixing. Caught at the right phase (regression CI), not in prod.
**Why I missed it locally**: I tested the probe via direct dist path (`./dist/index.js` from inside `packages/ai/`) — never tested the package-name form locally because workspace package-name resolution is fragile in different CWD/context combinations and I figured "it works in CI." It didn't. Lesson: if the local equivalent isn't *the same command*, it's not a real verification.

### 2. **Worktree env quirks slowed validate phase**
**Problem**: `prep-issue.sh` ran `npm install` instead of `pnpm install` in the worktree. That created a stray `package-lock.json` (which I declined to commit) and didn't set up pnpm workspace symlinks properly. Then `pnpm typecheck` failed because `@prisma/client` didn't have `PrismaClient` exported (Prisma client wasn't generated in this worktree).
**Impact**: Two extra commands (`pnpm install`, `pnpm db:generate`) before local validation could run.
**Root cause is in prep-issue.sh, not my code**: prep-issue.sh assumes all repos are npm-based. CustomerEQ uses pnpm workspaces. Worth filing a FRAIM issue if other contributors hit this.

## What Went Wrong

1. **First-pass CI miss on the probe target**. Should have either (a) tested the exact docker-run command locally before pushing, or (b) recognized that workspace package resolution from `node -e` is brittle and started with the dist path. Cost ~7 minutes of CI cycle.
2. **Repeated reminder-system noise from the harness about TaskCreate/TaskUpdate**. The system kept inserting reminders to use task tracking. For this kind of mechanical multi-phase walk-through, task-list overhead would be more friction than help. Ignored as instructed.

## What Went Right

1. **Spike-first paid off again**. The design phase's 3-minute spike on `module_format "esm"` meant implementation was 1 line of production code. The whole impl phase ran fast because the design was right.
2. **Empirical local verification before the CI cycle**. Reproduced the bug in the worktree; verified the fix via direct dist import; ran typecheck + smoke; only then pushed. Caught issues without burning CI time on most of them.
3. **Architecture-doc updates done in the right phase**. FRAIM rules say defer arch-doc edits to `implement-architecture-update` — I followed that instead of pre-emptively editing during code phase. Result: the doc edits don't muddle the impl commit's diff and have their own commit (`e3875ee`).
4. **CI iteration cycle was tight**. CI failure at `c9b1a58` → root-caused via log inspection (read the actual error message, didn't speculate) → fix at `8a846d6`. Total ~10 minutes from red to green.
5. **No new placeholders, no TODO comments, no half-finished pieces**. Every file change is final.

## What I Almost Did Wrong But Caught

1. **Almost committed `package-lock.json`**. prep-issue.sh's `npm install` left a stray lock file in the worktree root. Caught when staging — `git status` showed `M package-lock.json` and I deliberately added only the intended files. If I'd used `git add .` it would have polluted the PR with an npm lockfile in a pnpm repo.
2. **Almost renumbered architecture.md sections**. Initial instinct was to insert a new §3.6 AI Layer between §3.5 Shared Layer and §3.6 UI Layer. A grep across `docs/` caught that `docs/feature-specs/170-onboarding-first-run.md` cross-references `§3.7` — renumbering would have broken that. Instead inserted as `§3.8` at the end of §3, no renumbering, no broken cross-refs.

## Where Past Learnings Actually Fired

1. **"Prove root cause empirically not by attribution"**: when the package-name probe failed in CI, I read the full error message (`/app/[eval1]`, `code: 'ERR_MODULE_NOT_FOUND'`) and reasoned about pnpm's hoisting behavior — didn't guess at "maybe the image is broken" or "maybe Docker layered weirdly."
2. **"Don't ask about baseline dev env"**: docker-compose containers were already up from earlier in the session; I confirmed via `docker ps` and proceeded without re-confirming with the user.
3. **"Diagnose my own script before blaming externals"**: when `pnpm typecheck` failed with `PrismaClient` not exported, I didn't blame Prisma — checked `pnpm db:generate` was the missing step, ran it, moved on.
4. **"Read config before asserting its contents"**: before the architecture doc update, I grep'd for `§3.[6-9]` cross-references across `docs/` to confirm whether renumbering was safe. Caught the `170-onboarding-first-run.md` reference.

## Lessons Learned

1. **Test the *exact* command you'll run in CI, not a moral equivalent**. The local "import dist directly" probe verified the BAML output but not the actual workflow command. If I'd run `docker build -t ceq-api:test . && docker run --rm --entrypoint node ceq-api:test --input-type=module -e "..."` locally with the package-name version, I'd have caught the resolution issue before pushing.
2. **For multi-phase mechanical work, FRAIM's phase-by-phase mentoring + evidence requirements add real value but the harness reminders to use task-list tools are overhead**. Continuing to ignore those reminders for this category of work.
3. **`prep-issue.sh` runs `npm install` in pnpm repos**. Not my bug to fix here, but worth a FRAIM issue: the script should detect `pnpm-lock.yaml` and use pnpm.
4. **Architecture-doc cross-references survive renames better than renumbering**. When adding a new layer/section/subsection to a long structural document, prefer appending over inserting-and-renumbering even if the result is less topologically perfect.

## Agent Rule Updates Made to avoid recurrence

1. **None automated yet**. Worth adding to memory or CLAUDE.md (subject to user approval): "When adding a CI step that runs commands inside a built Docker image, locally execute the same `docker build` + `docker run` against a test tag before pushing. Direct equivalents in the host shell (e.g., importing the source dist) verify the codegen output but not the workflow's actual invocation contract."

## Enforcement Updates Made to avoid recurrence

1. **The new CI gate (`Verify */ image module resolution`) is itself the enforcement**. It catches the regression class this whole issue was about, every time, at PR review. No further enforcement needed at this layer.
2. **Architecture doc now names the BAML build-pipeline contract** (§3.8). The next person editing `packages/ai/baml_src/generators.baml` or the build script will find a documented contract instead of an implicit one. That was the core enforcement gap behind `bdfadf0`'s silent regression.
