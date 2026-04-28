---
author: manohar.madhira@outlook.com
date: 2026-04-24
synthesized: 2026-04-27
---

# Postmortem: FRAIM project-onboarding + docker-compose pgvector fix — Issues #179 and #178

**Date**: 2026-04-24
**Duration**: Single session, ~2 hours end-to-end (including Docker install, branch-correction detour, and end-of-day debrief)
**Objective**: Resolve a "DB drift" symptom on local dev (Prisma seeing partial migration state on a freshly started Docker Postgres), unblock Redis, and subsequently — after user prompting — run the FRAIM `project-onboarding` job to bring this repo's FRAIM surface into a consistent state.
**Outcome**: Success with two course corrections. Two PRs landed on `main` (`#184` pgvector image pin, `#183` FRAIM onboarding). EOD debrief + this postmortem follow in a third PR (`#186`).

---

## Executive Summary

What started as "resolve DB drift and start Docker for Redis" turned into a two-issue, two-PR onboarding cycle because two assumptions failed: (1) that diving straight into tool calls was acceptable in a FRAIM-equipped repo, and (2) that a small "dev env" fix could ride along on an active issue's feature branch. Both were corrected mid-session on user prompting. The real root cause of the DB drift was a host-installed Windows Postgres service silently intercepting `localhost:5432` connections, not any Docker or migration issue. After stopping that service, `pnpm db:migrate` then surfaced a second problem: the committed `postgres:16-alpine` image in `docker-compose.yml` lacked the pgvector extension required by migration `20260403000000_add_kb_articles`. That became issue #178.

Subsequently, running `/fraim project-onboarding` produced the changes in #179 — schema-aligning `fraim/config.json`, clarifying rule 10 (no `develop` branch exists; always issue-first branching), appending three new rules (R19 Docker-first, R20 pgvector pinned, R21 branch scope hygiene), adding two ADRs (0002 pgvector, 0003 Docker-first), and seeding L1 learning files for the user's email.

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/adr/0002-pgvector-postgres-image.md` and `docs/architecture/adr/0003-docker-first-local-dev.md` created. `docs/architecture/architecture.md` not modified; the stack table's database row is accurate without editing (the ADRs establish the local-dev pin without changing the production-side tech-stack choice).

**Changes Made**:
- ADR 0002 pins `pgvector/pgvector:pg16` as the local/compose Postgres image and documents why the stock `postgres:16-alpine` is not acceptable.
- ADR 0003 codifies Docker-first local development and the host-Postgres collision remediation.

**Rationale**: Both are first-class architectural decisions that affect anyone setting up local dev. They are one-way doors per project rule #4 — reversing them would break the `kb_articles` migration path or reintroduce the port-collision class of drift.

**Updated in PR**: Yes — in #183 (ADRs) and #184 (the compose image change itself).

---

## Timeline of Events

### Phase 0: Tool calls before FRAIM (the miss)

- ❌ **Did not read `fraim/personalized-employee/rules/project_rules.md`**, did not scan FRAIM jobs, did not invoke `fraim_connect`. Went straight into `docker compose up -d`, migration status checks, and port-collision diagnosis.
- ✅ **Correctly diagnosed root cause**: two processes listening on 5432 (Windows `postgresql-x64-16` service + Docker). Did not brute-force "reset everything" — asked which option (stop service vs. remap ports) and waited for user direction.
- ✅ **Asked before stopping the Windows service**: user-approved `net stop` + `sc config ... start= demand`.
- ❌ **Committed the pgvector fix on `feature/170-epic-onboarding-first-run-experience`** — an active issue branch for a completely unrelated onboarding epic.

### Phase 1: User prompts "Are you following FRAIM? Ideally should it have been a different branch?"

- ✅ **Immediately acknowledged the miss** on both counts (no FRAIM, wrong branch) and investigated.
- ✅ **Read `project_rules.md`** and confirmed rule 10 violation (branch tied to issue #170 for an off-topic fix) plus the stale `develop` reference in the rule.
- ✅ **Proposed a cheap reversal plan**: cherry-save the commit onto a new branch, reset the feature branch back to origin, then branch off `main` for the onboarding work.

### Phase 2: User confirms "Use Option A ... I will switch the other project also to use Docker"

- ✅ **Branch correction executed cleanly**: created `feature/issue-178-compose-pgvector` at the pgvector commit, hard-reset `feature/170-...` to `origin/`, checked out `main`, pulled 7 new commits, branched `feature/issue-179-fraim-project-onboarding`.
- ✅ **Filed issues #178 and #179 before executing the correction** — no more retroactive branch-to-issue mapping.

### Phase 3: FRAIM `project-onboarding` execution

- ✅ **Phase 1 (discover-and-analyze)**: read `~/.fraim/config.json`, `fraim/config.json`, `package.json`, `project_rules.md`, verified all four `customizations` doc paths exist on disk, fetched `templates/manager/fraim-config-schema.ts` to identify schema drift (`validation` keys, `compliance` shape).
- ✅ **Phase 2 (user-review-and-approval)**: presented three-bucket discovery. User selected 1b (rule 10 branch naming authoritative), effectively 2a-then-2b once the absence of `develop` surfaced, 3b/4b (schema-compliant keys alongside existing extensions), 6-yes on R19/R20/R21.
- ❌ **Over-scoped momentarily**: user said "add all the later items now" — nearly hand-generated 120+ FRAIM job/skill/rule stubs and a faked `docs/compliance/` bundle. Pushed back with scope analysis; user accepted narrower scope (AGENTS/CLAUDE pointer fix, 2 ADRs, learnings starter).
- ✅ **Design-system pushback from user**: claimed "no design system doc exists" after one narrow glob. User correctly pointed out docs/ has design content. Re-searched and found `docs/architecture/architecture.md` (UI tech decisions) + `docs/replicate/screenshots/component-catalog.md` (competitor reference). Pointed `customizations.designSystem.path` at `architecture.md`.
- ✅ **Phase 3 (write-config-and-rules)**: wrote 8 files — 4 modified, 4 new — in a single parallel batch.
- ✅ **Phase 4 (submit)**: evidence doc + commit + push + PRs `#183` (onboarding) and `#184` (pgvector) with gh, added labels (`status:needs-review`, `fraim`, `process` on #179; `status:needs-review`, `infrastructure`, `tech-debt` on #178), added evidence link comment on #183. Both merged on confirmation.

### Phase 4: End-of-day debrief

- ✅ **FRAIM `end-of-day-debrief`**: synthesized 4 unsynthesized retrospectives (#2, #71, #153, #166) into 23 pending proposals across 4 L1 files (5 mistake-patterns, 5 preferences, 4 manager-coaching, 9 validated-patterns). The `manager-coaching.md` and `validated-patterns.md` files were created fresh; the two existing files had their pending sections overwritten per job spec.
- ⚠️ **Today's session signals were overwritten**: the pending entries written during #179's Phase 3 for today's learnings were replaced by the retrospective-driven synthesis, because today's session had no retrospective or raw/ coaching-moment file as an L0 input. This postmortem exists specifically to fix that gap for the next EOD run.

---

## Root Cause Analysis

### 1. Why FRAIM discovery was skipped initially

**Problem**: The user's opening ask — "I have installed Docker now, so start on resolving DB drift and starting docker for redis" — reads as a small operational task: start services, fix a migration, done. The agent pattern-matched on "quick dev-env operation" and went straight to `docker compose up`. The existing memory `feedback_fraim_before_plan_mode.md` says "never plan mode" but its wording was specifically about Claude plan mode, not about dismissing all structured discovery. The agent interpreted the absence of plan mode as permission to skip *all* pre-act scaffolding, including FRAIM.

**Impact**: Committed an off-topic fix on the wrong branch, with no issue tied to it, in violation of rules 10 and R21 (neither of which the agent read before acting). Recovery cost: two extra branch-surgery rounds, two issues filed retroactively, two separate PRs instead of the originally-committed one.

**Category**: Process — the "FRAIM before acting" rule needs to explicitly include operational/dev-env tasks, not only "features" or "design" work.

### 2. Why the pgvector fix was committed on the 170 branch

**Problem**: The current working directory is literally named `C:\Github\mathurus\CustomerEQ - Issue 170` — a worktree-like directory for issue 170's onboarding epic. The checked-out branch was `feature/170-epic-onboarding-first-run-experience`. When the pgvector fix became committable, the agent did not stop to ask whether this branch was the right home for it.

**Impact**: Same as above — violated R21 branch scope hygiene before R21 existed as a written rule.

**Category**: Process — needs a pre-commit checkpoint that asks "is this fix in the current branch's acceptance criteria?" R21 is now the written rule; this retrospective makes sure next time it actually gets applied.

### 3. Why the "DB drift" symptom was confusing

**Problem**: On Windows, both a host-installed Postgres service and a Docker container can appear to bind `0.0.0.0:5432` and both show as LISTENING in `netstat`. Only one actually serves connections to `localhost` (typically the service that started first — the Windows service, as a persistent system service). Prisma saw the host DB's partial `_prisma_migrations` state; `docker exec psql` saw the empty container. This presents as "migration drift" but is actually a port-interception.

**Impact**: Without diagnosing the silent intercept, the instinctive recovery is "reset the Docker volume and retry," which would fail identically (because Prisma is still talking to the host). Diagnostic cost: one `netstat -ano | grep :5432` + `tasklist` lookup. ADR 0003 now documents this so the next person hitting it skips the hour-of-confusion stage.

---

## What Went Wrong

1. **Skipped FRAIM discovery entirely**: the single largest miss of the day. A two-minute read of `project_rules.md` up front would have surfaced rule 10 (branch-issue linkage) before the pgvector fix was ever committed to the wrong branch.

2. **Committed an unrelated fix on a feature branch**: the pgvector change was legitimately orthogonal to issue #170 and should have been its own branch from the first commit, not after a correction round.

3. **Claimed a file was missing after a narrow search**: "no design system doc exists" was based on a single glob pattern (`docs/**/*design-system*`). User correctly pushed back. A broader `docs/**/*.md` survey + keyword grep would have surfaced `component-catalog.md` and the UI sections of `architecture.md` on the first pass.

4. **Over-scoped when given "add all" permission**: when the user said "add all the later items now," the first instinct was to hand-generate 120+ FRAIM stub files and a faked compliance bundle, rather than audit which items were actually in scope for `project-onboarding` vs. owned by other FRAIM jobs. Pushed back before writing anything destructive, but the initial impulse was wrong.

5. **EOD debrief overwrote today's in-session signals**: because the synthesis input set is strictly `raw/` coaching moments + unsynthesized retrospectives, the pending entries the agent wrote during #179's Phase 3 for today's learnings got wiped when EOD ran. The learnings survive in `project_rules.md`, ADRs, and user memory, but the L1 files lost them. This postmortem exists to close the loop.

---

## What Went Right

1. **User correction was absorbed cleanly on first pass**: when asked "Are you following FRAIM?" the agent did not defend — it acknowledged the miss, scanned FRAIM rules and structure, and proposed a concrete remediation plan (new branches, reset, file issues, restart onboarding on the right branch). No rework loops.

2. **Branch correction was fully reversible**: because none of the original work had been pushed, the entire fix was `git branch <new>` + `git reset --hard origin/<original>` + `git checkout main` + `git checkout -b <new feature>`. Zero force-push, zero history rewrite, zero data loss.

3. **Two clean, scope-disjoint PRs**: #184 (one-line docker-compose.yml change) and #183 (markdown + config, no source code). Merged in the natural order (image change first, documentation of the change second) with zero conflicts.

4. **Host-Postgres collision diagnosed at the right level**: `netstat -ano | grep :5432` + `tasklist //FI "PID eq ..."` identified the two listeners and named them (`postgres.exe` PID 8176 = Windows service, `com.docker.backend.exe` PID 7332 = Docker) before any destructive recovery was attempted. ADR 0003 captures the diagnostic.

5. **Propose-then-execute discipline held for system-level actions**: `net stop postgresql-x64-16` and `sc config ... start= demand` were both presented for user approval before triggering UAC elevation, despite the user's clear intent.

6. **EOD debrief caught the gap it creates**: the job spec's "overwrite, don't append" semantic was followed strictly, and the agent immediately flagged that today's signals would be lost unless a retrospective was written. User requested exactly that — this file.

---

## What I Almost Did Wrong But Caught

1. **Almost hand-generated 120+ FRAIM discovery stubs**: when the user said "add all the later items now," the first impulse was to execute literally. Before writing anything, audited the four "later" items against (a) whether they were the current job's output and (b) whether they duplicated an upstream system of record. Pushed back with a table proposing to skip two (stubs, compliance bundle) and do two (ADRs, learnings starter). User agreed.

2. **Almost edited the FRAIM adapter block inside `AGENTS.md` / `CLAUDE.md` markers**: those sections are bracketed with `<!-- FRAIM_AGENT_ADAPTER_START -->` / `END`, which is a common "auto-managed section" signal. Edits inside would likely be overwritten by a future FRAIM sync. Added the "Repository Override" note *outside* the markers instead — same guidance reaches agents, no auto-gen collision.

3. **Almost ran `pnpm build && pnpm typecheck && pnpm test:smoke` on a markdown+JSON-only change**: rule 11 is a PR-merge gate, not a per-commit gate, and the change set cannot break compilation or unit tests. Skipped the full validation run with explicit rationale in the evidence doc. Recommended it still run on the PR side if CI would, and CI did (all green).

---

## Where Past Learnings Actually Fired

1. **`feedback_dont_ask_about_baseline_dev_env.md`** (partial): the agent did not re-confirm that Docker was installed or ask "is your dev env OK?" — it went straight to `docker ps`. That's the memory working correctly. However, this same memory likely contributed to skipping the broader FRAIM check ("dev env is baseline, this is a dev-env task, skip the scaffolding") — overextension of the rule. Memory has now been updated: `feedback_fraim_before_plan_mode.md` broadened to "FRAIM discovery before any action," and a new `feedback_issue_before_branch.md` was added specifically for the branch-linkage miss.

2. **Project rule 15 (Fix at the Right Abstraction Level)** fired correctly twice during the onboarding: (a) chose to put the FRAIM adapter override *outside* the auto-gen markers rather than editing inside, (b) chose to keep existing `fraim/config.json` flat keys as repo extensions rather than normalizing to schema and losing detail. Both match the spirit of "right level, not smallest."

3. **`analyze-why-you-messed-up` ethos** (not a memory, but the implicit coaching pattern from prior retrospectives): when the user asked "Are you following FRAIM?", the agent did not rationalize — it accepted the miss, identified the specific rule violations, and proposed a cheap recovery. That behavior mirrors the "accept the miss, convert it to a rule" arc that the earlier retrospectives demonstrate.

---

## Lessons Learned

1. **"Small operational ask" does not waive FRAIM discovery**. `docker compose up`, `pnpm db:migrate`, `git commit` — these are all non-trivial actions in a FRAIM repo. The rule is now "any action, not just feature work." Reflected in the updated `feedback_fraim_before_plan_mode.md` memory.

2. **The working directory name is a branch-scope trap**. Working in `C:\Github\mathurus\CustomerEQ - Issue 170` on branch `feature/170-...` primes the agent to assume anything committed here belongs to issue 170. Before every `git commit`, explicitly verify: is this change in the current branch's acceptance criteria? If no, branch off `main` with a new issue. Reflected in R21.

3. **Windows host-Postgres silently hijacks `localhost:5432`**. Docker Desktop on Windows does not error-out the port bind when another process owns it; both services appear LISTENING in `netstat`. Always verify the actual listener via `netstat -ano | grep :5432` + `tasklist //FI "PID eq <PID>"` before assuming Docker is winning. ADR 0003 codifies this.

4. **Markdown + config changes still warrant a PR**. Even changes that can't break anything benefit from (a) the linked issue trail for rule 10 compliance, (b) reviewer eyes on ADRs and rules before they become durable, and (c) CI as a sanity check against YAML/JSON parse errors.

5. **EOD debrief needs today's signals in a persistent input channel**. Writing to an L1 pending section mid-session is temporary state — it gets overwritten by the next EOD run unless there's a corresponding retrospective or `raw/` coaching moment. The fix is to always write a retrospective (or raw moments) at session end for any session that produced new learnings, not only for issue-scoped feature work.

6. **Two interleaved issues produce clean parallel PRs when branched cleanly**. Once #178 and #179 had their own branches off `main`, the two PRs landed independently without conflict. The alternative — one giant PR bundling "fix compose + onboarding" — would have been harder to review and would have muddied the git history.

---

## Agent Rule Updates Made to avoid recurrence

1. **R19 — Docker-First Local Development** (added to `project_rules.md`): Postgres + Redis run exclusively via `docker compose`; host-installed DB services must be stopped and set to Manual startup. Prevents the silent `:5432` interception that caused today's DB-drift confusion.

2. **R20 — pgvector Postgres Image Is Pinned** (added): `pgvector/pgvector:pg16` is the compose image; never downgrade to `postgres:16-alpine`. `kb_articles` migration requires the `vector` extension.

3. **R21 — Branch Scope Hygiene, One Issue Per Branch** (added): unrelated fixes get their own issue and branch; no bundling onto feature branches regardless of how small the fix.

4. **Rule 10 rewritten**: explicit "every branch must be tied to a GitHub issue; file the issue first, then branch"; removed stale reference to `develop` branch (which does not exist in this repo); PRs merge to `main`.

5. **Memory update — `feedback_fraim_before_plan_mode.md`**: broadened from "never plan mode" to "FRAIM discovery before any non-trivial action, including operational and dev-env tasks." Calls out that the session today was the second incident justifying the rule.

6. **Memory update — `feedback_issue_before_branch.md`** (new): explicit rule that every branch must be tied to an issue before creation; captures today's session as the triggering incident.

---

## Enforcement Updates Made to avoid recurrence

1. **AGENTS.md + CLAUDE.md "Repository Override" section** (outside auto-gen markers): points agents at the FRAIM MCP tools (`list_fraim_jobs`, `get_fraim_job`, `get_fraim_file`, `fraim_connect`) instead of non-existent local stub directories. Future agents in this repo have no excuse for skipping discovery on the grounds that "the expected stub dirs don't exist."

2. **ADRs 0002 and 0003**: codify pgvector pinning and Docker-first local dev at the architecture layer, not only in `project_rules.md`. Anyone reading `docs/architecture/adr/` gets both decisions with full context and alternatives analysis.

3. **L1 learning files for `manohar.madhira@outlook.com`**: freshly synthesized from the 4 unsynthesized retrospectives during EOD debrief — 23 pending proposals across mistake-patterns, preferences, manager-coaching, and validated-patterns. Review via `start-of-day-debrief` will promote approved entries into the L1 body.

4. **This retrospective**: written explicitly so that today's session signals are in a durable L0 input channel for the next EOD debrief. Otherwise they exist only in git history + memory files — legible but not structured for synthesis.
