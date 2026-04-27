# Mistake Patterns — manohar.madhira@outlook.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

**Last synthesized**: 2026-04-27

---

#### [P-HIGH] FRAIM discovery skipped or plan-mode entered before scanning job stubs

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 3
**First synthesized**: 2026-04-27

In a FRAIM-equipped repo, defaulting to Claude Plan mode or launching Explore agents before scanning `fraim/ai-employee/jobs/` stubs and calling `fraim_connect` + `get_fraim_job` is the most expensive recurring miss. Observed across 3 sessions: the 2026-04-20 broken-windows-detection coaching moment (raw/) where the user had to correct three times; the 2026-04-20 issue-157 broken-windows postmortem ("attempted to shortcut through FRAIM phases — marked report-generation phase as complete without creating the actual file"); and the 2026-04-24 issue-179 onboarding session ("dove directly into tool calls without first reading project_rules.md or matching the request to a FRAIM job"). The remediation is captured in feedback memory `feedback_fraim_before_plan_mode.md`; the fact that the pattern still resurfaced after the memory was saved is the reason this entry sits at score 9.0.

---

#### [P-HIGH] Committed an unrelated fix on an active feature branch

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

Landed the pgvector `docker-compose.yml` fix directly on `feature/170-epic-onboarding-first-run-experience` even though the change had nothing to do with issue #170. Violated rule 10 (branch-issue linkage) and the yet-to-be-written R21 (branch scope hygiene). The correct sequence: (1) notice the fix is off-scope for the current branch, (2) file a new issue, (3) branch off `main`, (4) commit. All of that must happen *before* `git commit`, not after. The cost was two extra branch-surgery rounds and two issues filed retroactively.

---

#### [P-HIGH] Symptom-level fix instead of systemic abstraction

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-04-27

When multiple files exhibit the same user-visible defect, mechanically replicating an existing "fix" across every file instead of solving the root cause at the shared layer. On issue #71, invisible form-input text was first "fixed" by adding `text-gray-900` to 50+ inputs across 7 files, mimicking the Programs page workaround. The real fix was a 5-line global CSS rule in `globals.css` setting `color: var(--foreground)` on `input, textarea, select`. This mistake directly motivated project rule #15.

---

#### [P-HIGH] Used `github.sha` under `workflow_run` without `head_sha` fallback

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-04-27

First instinct when adding a `workflow_run`-triggered job was to use `${{ github.sha }}` in `actions/checkout` and image-tag expressions. Under `workflow_run`, `github.sha` resolves to the default-branch tip at dispatch time — not the CI-tested commit. Without the `github.event.workflow_run.head_sha || github.sha` fallback, the deploy would have checked out and tagged the wrong commit's image — a subtle correctness bug that presents as a "working" deploy. Caught by re-reading GitHub Actions docs once before committing.

---

#### [P-HIGH] Marked design confidence "high" without verification (overconfident on abstraction)

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC (PR #196 Round 1), the IdentityProvider abstraction confidence row was rated "high" based on a desk-review of the interface shape — no codebase or documentation verification was done. Reviewer's single-question pushback ("Do we need a Spike to verify?") forced a retroactive spike that surfaced two real issues: `completeOAuth({code, state})` was the wrong shape for Clerk's mediated OAuth handshake (Clerk owns the callback; the app reads session, never receives code+state); and `createUserWithOrg` is internally 3 Clerk API calls with a hidden partial-failure mode. Lesson: "high confidence" on a new abstraction must be backed by either a PoC, a documentation re-read against the canonical SDK, or a parallel implementation review — never desk-only. The spike took ~30 minutes; the alternative (shipping a broken interface) would have been days of rework once integration started. Fixed-shape rule: any RFC row claiming "high confidence" on a not-yet-implemented external integration is overconfident unless the row also cites the verifying artifact.

---

#### [P-HIGH] Proposed a placeholder schema column for an unfinalized feature

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC (PR #196 Round 2), recommended adding `Brand.planTier: String?` as a "placeholder for the future pricing UI" — Decision #2 in the "Decisions for the reviewer" set, with `← recommended`. Reviewer reversed cleanly: *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."* The placeholder was a half-measure: it didn't enable any current functionality, would have required a follow-up migration to drop or repurpose, and pre-committed the schema to a string-shaped tier when the actual pricing model could be enum / FK / multi-row. Lesson: when a downstream feature is unfinalized, do **not** add schema fields "for forward compat" — the schema decision belongs with the pricing-strategy job that lands UI + data shape together. UX-only placeholder slots in mocks are fine; persistent columns are not. Captured durably in `project_pricing_not_finalized.md` (point #6).

---

#### [P-HIGH] Mock-vs-spec sync gaps when editing spec text without sweeping the mock

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

When editing a feature spec that has accompanying HTML/CSS mocks, spec-text edits with visual analogs were not paired with same-commit mock updates. On issue #170 (PR #187), Round 2 added a "Social / OAuth sign-in" section to the spec text but the corresponding Scene 1 mock was forgotten until the reviewer asked. Same root cause produced two further gaps caught only when the reviewer asked "is the mock in sync completely?" — a missing "Custom (set later)" 5th theme swatch and a Scene-4 dashboard CTA mismatch with the row-2 archetype indicator. The reviewer's "is X in sync?" pattern is a hard signal that the audit didn't happen — captured in feedback memory `feedback_audit_mock_vs_spec_at_every_round.md`.

---

#### [P-MED] `prep-issue.sh` runs `npm install` in pnpm-only repo

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: 2026-04-27

`~/.fraim/scripts/prep-issue.sh` defaults to running `npm install` after creating the worktree, but CustomerEQ is a pnpm/Turborepo workspace. On issue #166, the first smoke-test run failed with `Failed to load url @customerEQ/shared` because `node_modules/@customerEQ/*` were never built — required a manual `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter ... build`. On issue #177, almost ran into the same trap; caught it by passing `--skip-install` and running `corepack pnpm install` manually. Pattern: any pnpm-based repo invoking this FRAIM script should pass `--skip-install` and follow up with pnpm tooling.

---

#### [P-MED] FRAIM session state lost across context compaction

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

Long phased jobs can have their conversation context compacted mid-phase, which drops the FRAIM session ID and any in-progress state. Recovery requires re-connecting via `fraim_connect`, re-reading the RFC/spec to reconstruct context, and re-running `seekMentoring` to locate the current phase — roughly 15 minutes of overhead. Mitigation: at session start, note the session ID in a scratchpad (a comment in the active work file, a TaskCreate metadata field, or similar) so it survives compaction without re-connection side effects.

---

#### [P-MED] Wrote to gitignored `docs/evidence/` without checking `.gitignore` first

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

Created `docs/evidence/2-design-evidence.md` during issue #2 only to discover afterward that `docs/evidence/**/*.png` etc. patterns exist in `.gitignore` (and historically the whole directory was excluded). The file existed locally but could not be referenced from a PR, defeating its purpose. Before writing any evidence file, run a quick check of `.gitignore` for the target path. If the destination is gitignored, either change the destination or embed the summary directly in the PR body.

---

#### [P-MED] Phase 4 completeness review is a single-axis audit (spec-vs-source only)

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

The `feature-specification` job's Phase 4 traceability matrix catches spec-vs-source-requirement gaps (it caught #170's checklist-milestone gap correctly), but it does not catch mock-vs-spec gaps. On #170, three mock-vs-spec mismatches shipped to PR review because the completeness review was unidirectional. Mitigation: add a second pass to Phase 4 that walks every mock scene and confirms each visible element matches the spec's description of it. Cheap to run; catches a class of gap the existing matrix misses.

---

#### [P-MED] Claimed a file was missing without exhaustive search

**Score**: 5.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

During discovery, asserted "no design system doc exists" after running a single narrow glob (`docs/**/*design-system*`). The user pushed back that `docs/` contains substantial design content, which surfaced `docs/architecture/architecture.md` (UI tech decisions) and `docs/replicate/screenshots/component-catalog.md` (visual reference). Absence claims must be based on at least one broad survey (`docs/**/*.md`) plus keyword grep, not a single pattern match. Frame as "I did not find X under pattern Y" rather than "X does not exist" when the search was narrow.

---

#### [P-MED] Overcorrected toward generating unnecessary artifacts on broad approvals

**Score**: 4.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

When the user said "add all the later items," nearly started hand-generating 120+ FRAIM job/skill/rule discovery stubs — which are redundant with the live MCP catalog — and a faked `docs/compliance/` bundle that is the output of a separate `compliance-review` job. Correct response was to push back, explain the scope issue, and propose narrower writes (AGENTS.md/CLAUDE.md pointer fix, 2 ADRs, learnings starter). Lesson: before accepting a broad "do everything" instruction, audit each item against (a) whether it is the current job's actual output and (b) whether it duplicates an upstream system of record.

---

#### [P-LOW] Duplicate section numbering in RFC drafts

**Score**: 3.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

RFC for issue #2 shipped with two sections both numbered "2a" (Member model + Program model). Cosmetic — the content was correct — but caused confusion during implementation reference. A single final-pass read-through of the section outline before submit catches this class of error cheaply.
