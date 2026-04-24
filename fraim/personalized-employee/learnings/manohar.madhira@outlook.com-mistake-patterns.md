# Mistake Patterns — manohar.madhira@outlook.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] Skipping FRAIM discovery and jumping into execution

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

When given a request in a FRAIM-equipped repo, dove directly into tool calls (`docker compose up`, `pnpm db:migrate`, git commit) without first reading `fraim/personalized-employee/rules/project_rules.md` or matching the request to a FRAIM job. The result: work committed to the wrong branch, without an issue filed, and with project rules silently violated. FRAIM's pre-act discovery flow is mandatory in this repo — see `CLAUDE.md` FRAIM override and preferences entry "FRAIM job flow before acting."

---

#### [P-HIGH] Committed an unrelated fix onto an active feature branch

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

Landed the pgvector `docker-compose.yml` fix directly on `feature/170-epic-onboarding-first-run-experience` even though the change had nothing to do with issue #170. This violated rule 10 (branch-issue linkage) and the yet-to-be-written R21 (branch scope hygiene). The correct sequence: (1) notice the fix is off-scope for the current branch, (2) file a new issue, (3) branch off `main`, (4) commit. All of that must happen before `git commit`, not after. The existing `swavak@gmail.com-check-branch-scope-before-committing` raw learning covers the same pattern from a different user.

---

#### [P-MED] Claimed a file was missing without exhaustive search

**Score**: 5.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

During discovery, asserted "no design system doc exists" after running a single narrow glob (`docs/**/*design-system*`). The user pushed back that `docs/` contains substantial design content, which surfaced `docs/architecture/architecture.md` (UI tech decisions) and `docs/replicate/screenshots/component-catalog.md` (visual reference). Absence claims must be based on at least one broad survey (`docs/**/*.md`) plus keyword grep, not a single pattern match. Frame as "I did not find X under pattern Y" rather than "X does not exist" when the search was narrow.

---

#### [P-MED] Overcorrected into wanting to generate unnecessary artifacts

**Score**: 4.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

When the user said "add all the later items," nearly started hand-generating 120+ FRAIM job/skill/rule discovery stubs — which are redundant with the live MCP catalog — and a faked `docs/compliance/` bundle that is the output of a separate `compliance-review` job. Correct response was to push back, explain the scope issue, and propose narrower writes (AGENTS.md/CLAUDE.md pointer fix, 2 ADRs, learnings starter). Lesson: before accepting a broad "do everything" instruction, audit each item against (a) whether it is the current job's actual output and (b) whether it duplicates an upstream system of record.
