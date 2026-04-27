# Preferences — manohar.madhira@outlook.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

---

## ⏳ Pending Review — 2026-04-26

### Proposed new entries

#### [P-HIGH] FRAIM discovery flow before any non-trivial action

**Score**: 9.0
**Last seen**: 2026-04-26
**Recurrences**: 5
**First synthesized**: (pending)

Before executing any non-trivial user request in this repo, start the FRAIM discovery flow: (1) read `fraim/personalized-employee/rules/project_rules.md`, (2) match the request to a FRAIM job via `mcp__fraim__list_fraim_jobs`, (3) call `mcp__fraim__get_fraim_job` for the full phased instructions, (4) follow phases via `seekMentoring`. Do not enter Claude Plan mode; do not launch Explore agents ahead of FRAIM context. Confirmed across multiple sessions in 2026-04 (issues #157 broken-windows, #166, #170, #177, #179) — when this flow is followed, jobs run cleanly through their phases with zero rework; when it's skipped, work lands on wrong branches, phases are falsely marked complete, and recovery costs accumulate.

---

#### [P-HIGH] Browser validation of UI changes before submit is non-negotiable

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

For any UI-facing change, the user expects actual browser testing (Playwright or manual) before the implementation phase is reported as complete. Typecheck + build + smoke-test passing is not sufficient validation for React state sync, form population, rendering, or styling. On issue #153, the user's pushback ("Have you tested these?") forced full local-env setup and browser validation — which then confirmed the fix worked end-to-end. Default behavior should be to set up whatever is needed (Docker, local DB, Clerk, browser) rather than relying on compile-time checks.

---

#### [P-HIGH] Tight PR scope — no opportunistic scope creep

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

The user values PRs that do exactly one thing. Issue #166 was a `deploy.yml` hardening: +29/-7 on one file, with a tangentially related concern (third-party action SHA-pinning) deferred to a follow-up. Issue #177 (Node 22 bump) explicitly deferred three pre-existing test-coverage gaps (no e2e in CI, no real-Redis tests, no image-boot smoke) into a "Pre-existing gap → Why not addressed here → Recommendation" table rather than expanding the security-driven update. On issue #170 spec, when prompted for "all the later items" the agent had to push back and trim to the items actually in scope. Default stance: if a fix is discovered mid-task but outside the issue's acceptance criteria, file a separate issue, do not bundle. Related: project rule R21 (one issue per branch) formalizes the branch-level version of this preference.

---

#### [P-HIGH] Prefer systemic fixes over per-file fixes for cross-cutting issues

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: (pending)

When a bug affects multiple files with the same root cause, the user expects the fix to live at the shared layer — `globals.css`, a shared component, a utility, or a config — not replicated per file. On issue #71, the user's one-line pushback ("Why are you individually updating style in each file? Isn't having global style a better pattern?") triggered a full revert of a 7-file change in favor of a 5-line global CSS rule. This preference is now formalized as project rule #15.

---

#### [P-HIGH] Surface open decisions with recommended defaults for one-round resolution

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

When presenting design decisions for reviewer sign-off (RFC review, architectural tradeoffs), the user responds fastest when each open decision is framed as a small set of concrete options with one marked `← recommended`. On issue #2, both open decisions resolved in a single round because each had a recommended default. On issue #170, OD-1 through OD-5 (five open architectural decisions) all resolved in single review rounds — three came back as one-word "Agreed", one was reversed cleanly with a one-line rationale, one was added new in response to a theme. On issue #177, three "Decisions for you" at the bottom of the PR body got three answers in a single chat turn. Default presentation format: numbered binary/ternary choice, one-line tradeoff per option, explicit `← recommended` on the preferred path.

---

#### [P-MED] Pre-execution confirmation on multi-section rewrites

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: (pending)

Before executing a multi-section rewrite of a spec or RFC, ask 1–3 pre-execution questions and wait for shorthand answers ("yes to all", "1b/2a/3b" style). On issue #170 spec, both Round 1 and Round 2 used this pattern and converted what would have been 30+ message round-trips into single-message direction. Don't dive into a multi-section rewrite without pre-confirmed direction — the cost of asking is small relative to the cost of rewriting twice.

---

#### [P-MED] Thorough parallel context-gathering before design

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

For design and RFC phases, reading all relevant context files (schema, existing routes, worker code, shared types, architecture doc, project rules, UI mocks) in parallel at the start of the phase produces better outcomes than sequential/on-demand reads. On issue #2, reading 8 key files upfront captured the `brandId`-from-JWT pattern, soft-delete approach, BullMQ split, and existing rule evaluator behavior — all of which shaped the RFC correctly on the first draft. On issues #170 and #177, parallel Explore subagents ran a full surface enumeration in one round and produced exactly the inputs the RFC needed (no back-and-forth, no missed surfaces).

---

#### [P-MED] User confirms quickly with shorthand once direction is clear

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: (pending)

When given a structured list of pre-execution questions or open decisions, the user responds with terse shorthand ("yes to all", "1b/2a/3b", "Agreed"). On issue #170 spec, multiple rounds of multi-question direction-setting got single-message answers. Optimize for this pattern: prefer batched questions over interleaved confirmations; use numbered/lettered options that the user can reference compactly.

---

#### [P-MED] User does not manually close issues or PRs

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: (pending)

The user does not manually close GitHub issues or PRs from the UI; closes happen either via merge auto-close (`Closes #N` in PR body) or via explicit asks ("merge and close"). On 2026-04-25, the agent incorrectly described issue #157 as having been "closed manually" based on a `commit_id: null` close event; the user clarified that this is never the case for them. Captured in feedback memory `feedback_user_does_not_manually_close.md`. Implication: when investigating a closed-without-merge state, do not jump to "user clicked close in UI" — the actor is more likely a CLI/script call from a previous session or another tool.
