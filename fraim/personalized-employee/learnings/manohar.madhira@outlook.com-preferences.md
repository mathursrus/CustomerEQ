# Preferences — manohar.madhira@outlook.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] FRAIM job flow before acting

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

Before executing any non-trivial user request in this repo, start the FRAIM discovery flow: (1) read `fraim/personalized-employee/rules/project_rules.md`, (2) match the request to a FRAIM job via `mcp__fraim__list_fraim_jobs`, (3) call `mcp__fraim__get_fraim_job` for the full phased instructions. Do not dive straight into code, branching, or commits. Confirmed on 2026-04-24 during a DB-drift / Docker setup session that ended up producing commits on the wrong branch because FRAIM was skipped.

---

#### [P-HIGH] File an issue before creating a branch

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

Every branch must be tied to a GitHub issue. File the issue first (or identify the existing one), then create the branch as `feature/issue-{N}-{slug}`. "Small" fixes — dev-env patches, compose image bumps, config corrections — are not exempt. Confirmed on 2026-04-24: user corrected course after a pgvector compose fix was committed on an unrelated feature branch. See project rules 10 and R21.

---

#### [P-MED] Propose, then execute — especially for system-level or destructive actions

**Score**: 6.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

For actions that touch system services (Windows service stop/start, startup type changes), destructive git operations (hard reset, force push), or multi-file writes, propose the plan and wait for confirmation before executing — even when the user's intent is clear. The user is comfortable approving quickly; they are not comfortable with unreviewed side effects. Confirmed on 2026-04-24 when proposing `net stop postgresql-x64-16` and the branch-reset plan.

---

#### [P-MED] Terse, structured responses with clear options

**Score**: 5.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: (pending)

Prefer short, structured responses — tables, numbered lists, "Option A / Option B" framing — over long prose. When multiple decisions are pending, batch them into a single compact checklist and accept shorthand answers (e.g., "1b, 2a, 3b"). Observed as the user's consistent reply style across the 2026-04-24 session.
