# Evidence — Issue #179: FRAIM project-onboarding

## Summary

- **Issue**: [#179](https://github.com/mathursrus/CustomerEQ/issues/179) — `chore(fraim): run project-onboarding — align config, rules, AGENTS/CLAUDE, learnings`
- **Workflow type**: project-onboarding (FRAIM job)
- **Branch**: `feature/issue-179-fraim-project-onboarding` (off `main` @ `5c88606`)
- **Purpose**: Align the repo's FRAIM surface (config, rules, agent guidance, learnings, ADRs) with reality — without hand-generating upstream-owned artifacts.

## Work Completed

### Modified files (4)

| File | Change |
| :--- | :--- |
| `fraim/config.json` | Added schema-compliant keys alongside existing repo extensions: `customizations.validation.buildCommand`/`testSuiteCommand`/`smokeTestCommand`; `customizations.compliance.regulations[]` + `compliance_specifications{}`; new `customizations.designSystem = { path: "docs/architecture/architecture.md", brand: "CustomerEQ" }`. Updated `localDev.notes` and `stack.database` to reference pgvector. |
| `fraim/personalized-employee/rules/project_rules.md` | Rule 10 rewritten: removed the stale `develop` merge target (no such branch exists in this repo), added explicit "every branch must be tied to an issue" intent, added R21 cross-reference. Appended **R19 (Docker-first local dev)**, **R20 (pgvector postgres image pinned)**, **R21 (branch scope hygiene — one issue per branch)**. Bumped `Last updated` to 2026-04-24. |
| `AGENTS.md` | Appended "FRAIM — Repository Override (CustomerEQ)" section *outside* the `FRAIM_AGENT_ADAPTER` markers so future syncs do not clobber it. Points agents at `mcp__fraim__list_fraim_jobs` / `get_fraim_job` / `get_fraim_file` / `fraim_connect`, because the generic adapter's referenced stub directories (`fraim/ai-employee/jobs/`, `fraim/ai-manager/jobs/`) do not exist in this repo. |
| `CLAUDE.md` | Same override as `AGENTS.md` for parity. |

### New files (4)

| File | Purpose |
| :--- | :--- |
| `docs/architecture/adr/0002-pgvector-postgres-image.md` | ADR recording the decision to pin `pgvector/pgvector:pg16` as the compose `postgres` image (driven by issue #178 and the `kb_articles` migration's `CREATE EXTENSION vector`). |
| `docs/architecture/adr/0003-docker-first-local-dev.md` | ADR recording the decision to run Postgres and Redis exclusively via Docker in local dev, with host-installed Postgres services stopped to prevent silent `:5432` port interception (the root cause of the "DB drift" symptom that motivated issue #179). |
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-preferences.md` | Starter preferences file with 4 pending-review entries drawn from the 2026-04-24 session: FRAIM-first, issue-first branching, propose-then-execute for system actions, terse/structured response style. |
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md` | Starter mistake-patterns file with 4 pending-review entries: skipped FRAIM discovery, committed unrelated fix to active feature branch, claimed absence without exhaustive search, overcorrected toward generating unnecessary artifacts. |

## Approach

Phased FRAIM execution:

1. **discover-and-analyze** — Read `~/.fraim/config.json`, `fraim/config.json`, `package.json`, repo structure; verified referenced doc paths exist; fetched `templates/manager/fraim-config-schema.ts` to identify schema drift; drafted three discovery buckets (Confirmed automatically / Needs your input / Can be added later) and candidate new rules.
2. **user-review-and-approval** — Presented discovery findings; user selected: rule 10 branch convention authoritative (1b), `develop` does not exist → drop it (effective 2a), schema-compliant keys added alongside existing extensions (3b, 4b), proceed with all three new rules R19–R21 (6 yes). Course-corrected mid-phase: filed issues #178 (pgvector fix) and #179 (this onboarding) before branching.
3. **write-config-and-rules** — Performed the 8 file writes above. Chose to place the AGENTS.md / CLAUDE.md override *outside* the `FRAIM_AGENT_ADAPTER_START/END` markers so it survives future catalog syncs.
4. **submit** — This evidence document.

### Scope decisions and what was intentionally NOT done

- **Hand-generating `fraim/ai-employee/` and `fraim/ai-manager/` discovery stubs** — FRAIM exposes 120+ jobs across many categories; stubs are a thin discovery layer, and the MCP catalog is the authoritative source. Instead, updated `AGENTS.md` + `CLAUDE.md` to redirect agents at the MCP tools. Avoids stub drift and aligns with the actual FRAIM control plane.
- **Faking a `docs/compliance/` bundle** — That is the output of the `compliance-review` FRAIM job, not `project-onboarding`. Deferred.
- **Running `pnpm build / typecheck / test:smoke`** — Rule 11 is a PR-merge gate. This change set is 100% markdown + JSON config and cannot break the typecheck or test suites; running the full build would be expensive theater. Still recommended before PR merge per rule 11.

## Validation

- `git status` shows only the 8 intended files changed; no collateral modifications.
- All `customizations` doc paths referenced in `fraim/config.json` confirmed present on disk (architecture, data-models, use-cases, implementation-roadmap, design system pointer).
- Rule 10 update reconciled with repo reality: `git branch -a` confirmed `develop` does not exist locally or remotely; `origin/HEAD -> origin/main`.
- Issues #178 and #179 filed before their respective branches were created.
- Branch `feature/issue-179-fraim-project-onboarding` was created off `main` after `git pull --ff-only`, per rule 10.

## Quality Checks

- ✅ All 8 deliverables complete and named per repo conventions.
- ✅ ADRs follow the format established by `0001-admin-crud-route-pattern.md` (Status / Date / Deciders / Context / Decision / Alternatives Considered / Consequences).
- ✅ Learnings files follow the format established by `sid.mathur@gmail.com-preferences.md` / `-mistake-patterns.md` (P-HIGH/MED tagging, Score, Last seen, Recurrences, First synthesized).
- ✅ New rules R19–R21 cross-reference ADRs 0002 and 0003 and each other.
- ✅ AGENTS.md / CLAUDE.md override placed outside auto-gen markers.
- ✅ No changes to source code; no risk to `pnpm build` / `typecheck` / `test:smoke`.

## Phase Completion

- Phase 1 `discover-and-analyze` — complete
- Phase 2 `user-review-and-approval` — complete
- Phase 3 `write-config-and-rules` — complete
- Phase 4 `submit` — in progress (this document)
